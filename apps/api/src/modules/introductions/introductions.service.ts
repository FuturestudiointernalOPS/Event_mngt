import { Injectable } from '@nestjs/common';
import {
  PERMISSIONS,
  type CreateIntroductionRequest,
  type IntroductionRequest,
  type IntroductionRequestDetail,
  type IntroductionStatus,
  type ListIntroductionRequestsQuery,
  type UpdateIntroductionRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import {
  TenantTransactionService,
  type TenantPrismaClient,
} from '../../database/tenant-transaction.service';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import {
  toIntroductionRequest,
  toIntroductionRequestDetail,
} from './introductions.mapper';
import {
  IntroductionsRepository,
  type UpdateIntroductionData,
} from './introductions.repository';
import {
  assertIntroductionTransition,
  assertOutcomeForStatus,
  assertReasonRequired,
  autoAssignEnabled,
  initialAssignment,
  reasonRequired,
} from './introductions.rules';

/**
 * Staff introduction queue (WP-17).
 *
 * The repository writes each transition and its single history row together inside the
 * caller's transaction, so a decided request can always be explained afterwards. Writes
 * are gated on the `introductions` module; reads keep history after it is disabled.
 */
@Injectable()
export class IntroductionsService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: IntroductionsRepository,
    private readonly modules: ModuleRegistryService,
  ) {}

  list(
    eventId: string,
    query: ListIntroductionRequestsQuery,
  ): Promise<PaginatedResult<IntroductionRequest>> {
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
        items: rows.map(toIntroductionRequest),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  detail(
    eventId: string,
    introductionId: string,
  ): Promise<IntroductionRequestDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const row = await this.repository.findDetail(
        tx,
        tenant.organizationId,
        eventId,
        introductionId,
      );

      if (!row) {
        throw AppException.notFound('not_found', 'Introduction request not found.');
      }

      return toIntroductionRequestDetail(row);
    });
  }

  create(
    eventId: string,
    input: CreateIntroductionRequest,
  ): Promise<IntroductionRequest> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const organizationId = tenant.organizationId;
      await this.modules.requireEnabled(
        tx,
        organizationId,
        eventId,
        'introductions',
      );
      const settings = await this.modules.requireEnabledSettings(
        tx,
        organizationId,
        eventId,
        'introductions',
      );

      const reason = input.reason?.trim() || null;
      assertReasonRequired(reasonRequired(settings), reason);

      const profile = await this.repository.findEligibleProfile(
        tx,
        organizationId,
        eventId,
        input.requestingProfileId,
      );

      if (!profile) {
        throw AppException.notFound('not_found', 'Profile not found.');
      }

      // A participant has no staff identity: an empty id is "no actor", so a request made
      // from the participant space is never auto-assigned to nobody.
      const actor = tenant.userId || null;
      const assignment = initialAssignment(autoAssignEnabled(settings), actor);

      const row = await this.repository.createWithHistory(
        tx,
        {
          organizationId,
          eventId,
          requestingProfileId: input.requestingProfileId,
          reason,
          offeredHelp: input.offeredHelp?.trim() || null,
          status: assignment.status,
          assignedToUserId: assignment.assignedToUserId,
        },
        actor,
      );

      return toIntroductionRequest(row);
    });
  }

  /** The requests a participant made themselves. */
  listForProfile(eventId: string, profileId: string): Promise<IntroductionRequest[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.modules.requireEnabled(tx, tenant.organizationId, eventId, 'introductions');
      const rows = await this.repository.listForProfile(tx, tenant.organizationId, eventId, profileId);
      return rows.map(toIntroductionRequest);
    });
  }

  update(
    eventId: string,
    introductionId: string,
    input: UpdateIntroductionRequest,
  ): Promise<IntroductionRequest> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const organizationId = tenant.organizationId;
      await this.modules.requireEnabled(
        tx,
        organizationId,
        eventId,
        'introductions',
      );

      const existing = await this.repository.findRequest(
        tx,
        organizationId,
        eventId,
        introductionId,
      );

      if (!existing) {
        throw AppException.notFound('not_found', 'Introduction request not found.');
      }

      const status = assertIntroductionTransition(existing.status, input.action);
      const data = await this.transitionData(
        tx,
        organizationId,
        status,
        input,
        tenant.userId,
      );

      const row = await this.repository.transition(tx, {
        organizationId,
        eventId,
        requestId: introductionId,
        fromStatus: existing.status,
        toStatus: status,
        actorUserId: tenant.userId,
        note: input.action === 'assign' ? null : (input.notes ?? null),
        data,
      });

      return toIntroductionRequest(row);
    });
  }

  private async transitionData(
    tx: TenantPrismaClient,
    organizationId: string,
    status: IntroductionStatus,
    input: UpdateIntroductionRequest,
    actorUserId: string,
  ): Promise<UpdateIntroductionData> {
    if (input.action === 'assign') {
      const member = await this.repository.findMemberWithPermission(
        tx,
        organizationId,
        input.assignedToUserId,
        PERMISSIONS.introductionManage,
      );

      if (!member) {
        throw AppException.unprocessable(
          'invalid_reference',
          'The assignee is not a member of this workspace who can manage introductions.',
        );
      }

      return { status, assignedToUserId: input.assignedToUserId };
    }

    assertOutcomeForStatus(status, input.outcome);

    return {
      status,
      outcome: input.outcome,
      outcomeNotes: input.notes ?? null,
      decidedAt: new Date(),
      decidedByUserId: actorUserId,
    };
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
