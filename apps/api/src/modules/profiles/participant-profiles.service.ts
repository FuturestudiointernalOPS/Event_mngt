import { Injectable } from '@nestjs/common';
import type {
  ListParticipantProfilesQuery,
  ModerateProfileRequest,
  ParticipantDirectoryEntry,
  ParticipantProfile,
  UpdateParticipantProfileRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import {
  TenantTransactionService,
  type TenantPrismaClient,
} from '../../database/tenant-transaction.service';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import { ParticipantProfilesRepository } from './participant-profiles.repository';
import { toParticipantProfile } from './profiles.mapper';
import {
  assertModeratable,
  defaultVisibility,
  nextModerationStatus,
} from './profiles.rules';

/**
 * Participant profiles and their moderation (WP-14).
 *
 * Staff edit on a participant's behalf; a participant edits their own through the
 * participant space. Any content edit invalidates an approval.
 */
@Injectable()
export class ParticipantProfilesService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: ParticipantProfilesRepository,
    private readonly modules: ModuleRegistryService,
  ) {}

  list(
    eventId: string,
    query: ListParticipantProfilesQuery,
  ): Promise<PaginatedResult<ParticipantProfile>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEvent(tx, tenant.organizationId, eventId);

      const [rows, total] = await this.repository.list(
        tx,
        tenant.organizationId,
        eventId,
        query.moderationStatus,
        (query.page - 1) * query.pageSize,
        query.pageSize,
      );

      return {
        items: rows.map(toParticipantProfile),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  detail(eventId: string, profileId: string): Promise<ParticipantProfile> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const row = await this.repository.find(
        tx,
        tenant.organizationId,
        eventId,
        profileId,
      );

      if (!row) {
        throw AppException.notFound('not_found', 'Profile not found.');
      }

      return toParticipantProfile(row);
    });
  }

  /** The participant's own profile, or null before they have written one. */
  getForRegistration(eventId: string, registrationId: string): Promise<ParticipantProfile | null> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.modules.requireEnabled(tx, tenant.organizationId, eventId, 'showcase');
      const row = await this.repository.findByRegistration(tx, tenant.organizationId, eventId, registrationId);
      return row ? toParticipantProfile(row) : null;
    });
  }

  /**
   * Other participants a registrant may propose a meeting to: approved, public and attached
   * to an approved registration. Names are reduced to a first name and a last initial.
   */
  directory(eventId: string, ownRegistrationId: string): Promise<ParticipantDirectoryEntry[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.modules.requireEnabled(tx, tenant.organizationId, eventId, 'showcase');
      const rows = await this.repository.listPublic(tx, tenant.organizationId, eventId);
      return rows
        .filter((row) => row.registrationId !== ownRegistrationId)
        .map((row) => ({
          profileId: row.id,
          displayName: `${row.registration.person.firstName} ${row.registration.person.lastName.charAt(0)}.`.trim(),
          headline: row.headline,
          company: row.company,
          jobTitle: row.jobTitle,
        }));
    });
  }

  /** Create or replace the profile attached to a registration. */
  upsert(
    eventId: string,
    registrationId: string,
    input: UpdateParticipantProfileRequest,
  ): Promise<ParticipantProfile> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const registration = await this.repository.findRegistration(
        tx,
        tenant.organizationId,
        eventId,
        registrationId,
      );

      if (!registration) {
        throw AppException.notFound('not_found', 'Registration not found.');
      }

      const settings = await this.modules.requireEnabledSettings(
        tx,
        tenant.organizationId,
        eventId,
        'showcase',
      );

      const existing = await this.repository.findByRegistration(
        tx,
        tenant.organizationId,
        eventId,
        registrationId,
      );

      const submit = input.submitForReview ?? false;
      const content = {
        headline: input.headline,
        bio: input.bio,
        company: input.company,
        jobTitle: input.jobTitle,
        websiteUrl: input.websiteUrl,
        photoUrl: input.photoUrl,
        visibility:
          input.visibility ??
          existing?.visibility ??
          defaultVisibility(settings.publicByDefault),
        moderationStatus: nextModerationStatus(
          existing?.moderationStatus ?? null,
          submit,
        ),
        submittedAt: submit ? new Date() : (existing?.submittedAt ?? null),
        ...(submit
          ? { moderatedAt: null, moderatedByUserId: null, moderationNote: null }
          : {}),
      };

      const row = existing
        ? await this.repository.update(
            tx,
            tenant.organizationId,
            eventId,
            existing.id,
            content,
          )
        : await this.repository.create(tx, {
            ...content,
            organizationId: tenant.organizationId,
            eventId,
            registrationId: registration.id,
          });

      return toParticipantProfile(row);
    });
  }

  update(
    eventId: string,
    profileId: string,
    input: UpdateParticipantProfileRequest,
  ): Promise<ParticipantProfile> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const existing = await this.repository.find(
        tx,
        tenant.organizationId,
        eventId,
        profileId,
      );

      if (!existing) {
        throw AppException.notFound('not_found', 'Profile not found.');
      }

      const submit = input.submitForReview ?? false;

      const row = await this.repository.update(
        tx,
        tenant.organizationId,
        eventId,
        profileId,
        {
          headline: input.headline,
          bio: input.bio,
          company: input.company,
          jobTitle: input.jobTitle,
          websiteUrl: input.websiteUrl,
          photoUrl: input.photoUrl,
          visibility: input.visibility,
          moderationStatus: nextModerationStatus(
            existing.moderationStatus,
            submit,
          ),
          submittedAt: submit ? new Date() : existing.submittedAt,
          ...(submit
            ? { moderatedAt: null, moderatedByUserId: null, moderationNote: null }
            : {}),
        },
      );

      return toParticipantProfile(row);
    });
  }

  moderate(
    eventId: string,
    profileId: string,
    input: ModerateProfileRequest,
  ): Promise<ParticipantProfile> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const existing = await this.repository.find(
        tx,
        tenant.organizationId,
        eventId,
        profileId,
      );

      if (!existing) {
        throw AppException.notFound('not_found', 'Profile not found.');
      }

      assertModeratable(existing.moderationStatus, input.decision);

      const row = await this.repository.update(
        tx,
        tenant.organizationId,
        eventId,
        profileId,
        {
          moderationStatus: input.decision,
          moderatedAt: new Date(),
          moderatedByUserId: tenant.userId,
          moderationNote: input.note ?? null,
        },
      );

      return toParticipantProfile(row);
    });
  }

  private async assertEvent(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<void> {
    const event = await this.repository.eventExists(
      tx,
      organizationId,
      eventId,
    );

    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }
  }
}
