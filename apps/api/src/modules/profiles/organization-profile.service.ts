import { Injectable } from '@nestjs/common';
import type {
  ModerateProfileRequest,
  OrganizationProfile,
  UpsertOrganizationProfileRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { ModerationStatus } from '../../database/prisma-client';
import { OrganizationProfileRepository } from './organization-profile.repository';
import { toOrganizationProfile } from './profiles.mapper';
import { assertModeratable } from './profiles.rules';

/**
 * The workspace's own showcase listing (WP-14).
 *
 * A change resets the listing to pending: an approved company description must not be
 * silently rewritten after review.
 */
@Injectable()
export class OrganizationProfileService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: OrganizationProfileRepository,
  ) {}

  get(): Promise<OrganizationProfile | null> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const row = await this.repository.find(tx, tenant.organizationId);

      return row ? toOrganizationProfile(row) : null;
    });
  }

  upsert(input: UpsertOrganizationProfileRequest): Promise<OrganizationProfile> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const existing = await this.repository.find(tx, tenant.organizationId);
      const now = new Date();

      const content = {
        name: input.name,
        description: input.description,
        websiteUrl: input.websiteUrl,
        logoUrl: input.logoUrl,
        contactEmail: input.contactEmail,
        country: input.country,
        sector: input.sector,
        visibility: input.visibility ?? existing?.visibility,
        moderationStatus: ModerationStatus.PENDING,
        submittedAt: now,
        moderatedAt: null,
        moderatedByUserId: null,
        moderationNote: null,
      };

      const row = existing
        ? await this.repository.update(tx, tenant.organizationId, content)
        : await this.repository.create(tx, tenant.organizationId, {
            ...content,
            name: input.name,
            visibility: input.visibility ?? 'PUBLIC',
          });

      return toOrganizationProfile(row);
    });
  }

  moderate(input: ModerateProfileRequest): Promise<OrganizationProfile> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const existing = await this.repository.find(tx, tenant.organizationId);

      if (!existing) {
        throw AppException.notFound('not_found', 'Organization profile not found.');
      }

      assertModeratable(existing.moderationStatus, input.decision);

      const row = await this.repository.update(tx, tenant.organizationId, {
        moderationStatus: input.decision,
        moderatedAt: new Date(),
        moderatedByUserId: tenant.userId,
        moderationNote: input.note ?? null,
      });

      return toOrganizationProfile(row);
    });
  }
}
