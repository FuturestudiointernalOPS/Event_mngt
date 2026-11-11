import { Injectable } from '@nestjs/common';
import type {
  CreateMeetingRequest,
  ListMeetingsQuery,
  Meeting,
  UpdateMeetingRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import {
  TenantTransactionService,
  type TenantPrismaClient,
} from '../../database/tenant-transaction.service';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import { toMeeting } from './meetings.mapper';
import { MeetingsRepository } from './meetings.repository';
import {
  assertParticipantMayRespond,
  assertDistinctProfiles,
  assertMeetingTransition,
  assertProposalLimit,
  maxProposalsPerParticipant,
  requiresStaffConfirmation,
} from './meetings.rules';

/**
 * Staff meeting surface (WP-17).
 *
 * Staff act on the participants' behalf: the recipient-only accept/decline rule needs a
 * participant account link and is deferred to the participant slice, which will call the
 * same rules. Every write is gated on the `meetings` module.
 */
@Injectable()
export class MeetingsService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: MeetingsRepository,
    private readonly modules: ModuleRegistryService,
  ) {}

  list(
    eventId: string,
    query: ListMeetingsQuery,
  ): Promise<PaginatedResult<Meeting>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEvent(tx, tenant.organizationId, eventId);

      const [rows, total] = await this.repository.list(
        tx,
        tenant.organizationId,
        eventId,
        query.status,
        (query.page - 1) * query.pageSize,
        query.pageSize,
      );

      return {
        items: rows.map(toMeeting),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  propose(eventId: string, input: CreateMeetingRequest): Promise<Meeting> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const organizationId = tenant.organizationId;
      await this.modules.requireEnabled(tx, organizationId, eventId, 'meetings');
      const settings = await this.modules.requireEnabledSettings(
        tx,
        organizationId,
        eventId,
        'meetings',
      );

      assertDistinctProfiles(input.proposerProfileId, input.recipientProfileId);

      const profiles = await this.repository.findEligibleProfiles(
        tx,
        organizationId,
        eventId,
        [input.proposerProfileId, input.recipientProfileId],
      );
      const proposer = profiles.find((row) => row.id === input.proposerProfileId);
      const recipient = profiles.find((row) => row.id === input.recipientProfileId);

      if (!proposer || !recipient) {
        throw AppException.notFound('not_found', 'Profile not found.');
      }

      const duplicate = await this.repository.findActiveForPair(
        tx,
        organizationId,
        eventId,
        input.proposerProfileId,
        input.recipientProfileId,
      );

      if (duplicate) {
        throw AppException.conflict(
          'duplicate_meeting',
          'An active meeting already exists between these profiles.',
        );
      }

      const activeProposals = await this.repository.countActiveProposals(
        tx,
        organizationId,
        eventId,
        input.proposerProfileId,
      );
      assertProposalLimit(
        activeProposals,
        maxProposalsPerParticipant(settings),
      );

      const row = await this.repository.create(tx, {
        organizationId,
        eventId,
        proposerProfileId: input.proposerProfileId,
        recipientProfileId: input.recipientProfileId,
        durationMinutes: input.durationMinutes ?? 30,
        note: input.note ?? null,
        requiresStaffConfirmation: requiresStaffConfirmation(settings),
      });

      return toMeeting(row);
    });
  }

  update(
    eventId: string,
    meetingId: string,
    input: UpdateMeetingRequest,
  ): Promise<Meeting> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.modules.requireEnabled(
        tx,
        tenant.organizationId,
        eventId,
        'meetings',
      );

      const existing = await this.repository.find(
        tx,
        tenant.organizationId,
        eventId,
        meetingId,
      );

      if (!existing) {
        throw AppException.notFound('not_found', 'Meeting not found.');
      }

      const status = assertMeetingTransition(existing.status, input.action);

      const row = await this.repository.update(
        tx,
        tenant.organizationId,
        eventId,
        meetingId,
        {
          status,
          decidedAt: new Date(),
          decidedByUserId: tenant.userId,
          ...(input.action === 'complete'
            ? { outcome: input.outcome, outcomeNotes: input.notes ?? null }
            : {}),
        },
      );

      return toMeeting(row);
    });
  }

  /** The meetings a participant is part of. Staff-only data never appears in the contract. */
  listForProfile(eventId: string, profileId: string): Promise<Meeting[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.modules.requireEnabled(tx, tenant.organizationId, eventId, 'meetings');
      const rows = await this.repository.listForProfile(tx, tenant.organizationId, eventId, profileId);
      return rows.map(toMeeting);
    });
  }

  /**
   * A participant answers or cancels a meeting they are part of. A meeting that involves
   * someone else is reported exactly like a missing one.
   */
  respondAsParticipant(
    eventId: string,
    profileId: string,
    meetingId: string,
    action: 'accept' | 'decline' | 'cancel',
  ): Promise<Meeting> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.modules.requireEnabled(tx, tenant.organizationId, eventId, 'meetings');
      const existing = await this.repository.find(tx, tenant.organizationId, eventId, meetingId);
      const isProposer = existing?.proposer.id === profileId;
      const isRecipient = existing?.recipient.id === profileId;

      if (!existing || (!isProposer && !isRecipient)) {
        throw AppException.notFound('not_found', 'Meeting not found.');
      }

      assertParticipantMayRespond({
        action,
        isProposer,
        isRecipient,
        requiresStaffConfirmation: existing.requiresStaffConfirmation,
      });
      const status = assertMeetingTransition(existing.status, action);
      const row = await this.repository.update(tx, tenant.organizationId, eventId, meetingId, {
        status,
        decidedAt: new Date(),
        decidedByUserId: null,
      });

      return toMeeting(row);
    });
  }

  private async assertEvent(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<void> {
    const event = await this.repository.eventExists(tx, organizationId, eventId);

    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }
  }
}
