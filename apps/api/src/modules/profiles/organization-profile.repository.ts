import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import type {
  ModerationStatus,
  OrganizationProfile,
  ProfileVisibility,
} from '../../database/prisma-client';

export interface OrganizationProfileContent {
  name?: string;
  description?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  contactEmail?: string | null;
  country?: string | null;
  sector?: string | null;
  visibility?: ProfileVisibility;
  moderationStatus?: ModerationStatus;
  submittedAt?: Date | null;
  moderatedAt?: Date | null;
  moderatedByUserId?: string | null;
  moderationNote?: string | null;
}

/**
 * The workspace's own listing. One row per organisation, keyed by the organisation
 * itself rather than by an event, because a company profile is a workspace fact.
 */
@Injectable()
export class OrganizationProfileRepository {
  find(
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<OrganizationProfile | null> {
    return tx.organizationProfile.findUnique({ where: { organizationId } });
  }

  create(
    tx: TenantPrismaClient,
    organizationId: string,
    content: OrganizationProfileContent & { name: string },
  ): Promise<OrganizationProfile> {
    return tx.organizationProfile.create({
      data: { ...content, organizationId },
    });
  }

  update(
    tx: TenantPrismaClient,
    organizationId: string,
    content: OrganizationProfileContent,
  ): Promise<OrganizationProfile> {
    return tx.organizationProfile.update({
      where: { organizationId },
      data: content,
    });
  }
}
