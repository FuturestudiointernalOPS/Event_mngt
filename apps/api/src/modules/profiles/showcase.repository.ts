import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import type {
  Innovation,
  ModerationStatus,
  ProfileVisibility,
} from '../../database/prisma-client';

export interface InnovationContent {
  title?: string;
  summary?: string | null;
  category?: string | null;
  externalUrl?: string | null;
  imageUrl?: string | null;
  visibility?: ProfileVisibility;
  moderationStatus?: ModerationStatus;
  moderatedAt?: Date | null;
  moderatedByUserId?: string | null;
  moderationNote?: string | null;
  participantProfileId?: string | null;
  organizationProfileId?: string | null;
}

/** Showcase listings for one event. */
@Injectable()
export class ShowcaseRepository {
  list(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    moderationStatus: ModerationStatus | undefined,
    skip: number,
    take: number,
  ): Promise<[Innovation[], number]> {
    const where = { organizationId, eventId, moderationStatus };

    return Promise.all([
      tx.innovation.findMany({
        where,
        orderBy: [{ submittedAt: 'desc' }],
        skip,
        take,
      }),
      tx.innovation.count({ where }),
    ]);
  }

  find(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    innovationId: string,
  ): Promise<Innovation | null> {
    return tx.innovation.findFirst({
      where: { id: innovationId, organizationId, eventId },
    });
  }

  create(
    tx: TenantPrismaClient,
    data: InnovationContent & {
      organizationId: string;
      eventId: string;
      title: string;
    },
  ): Promise<Innovation> {
    return tx.innovation.create({ data });
  }

  update(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    innovationId: string,
    data: InnovationContent,
  ): Promise<Innovation> {
    return tx.innovation.update({
      where: { id: innovationId, organizationId, eventId },
      data,
    });
  }

  findParticipantProfile(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    profileId: string,
  ): Promise<{ id: string } | null> {
    return tx.participantProfile.findFirst({
      where: { id: profileId, organizationId, eventId },
      select: { id: true },
    });
  }

  findOrganizationProfile(
    tx: TenantPrismaClient,
    organizationId: string,
    profileId: string,
  ): Promise<{ id: string } | null> {
    return tx.organizationProfile.findFirst({
      where: { id: profileId, organizationId },
      select: { id: true },
    });
  }

  listPublic(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<Innovation[]> {
    return tx.innovation.findMany({
      where: {
        organizationId,
        eventId,
        moderationStatus: 'APPROVED',
        visibility: 'PUBLIC',
      },
      orderBy: [{ submittedAt: 'desc' }],
    });
  }
}
