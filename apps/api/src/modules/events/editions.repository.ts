import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import {
  EventFormat,
  EventVisibility,
} from '../../database/prisma-client';
import type { EventWithEditionCount, EventWithModules } from './events.mapper';

export interface CreateEditionData {
  organizationId: string;
  createdByUserId: string;
  parentEventId: string;
  slug: string;
  name: string;
  description: string | null;
  format: EventFormat;
  visibility: EventVisibility;
  timeZone: string;
  startsAt: Date;
  endsAt: Date;
  venueName: string | null;
  venueAddress: string | null;
  initialModuleKeys: string[];
}

/**
 * Edition queries. Every predicate carries both the organisation and the parent event,
 * so an edition can never be reached through another tenant or another series.
 */
@Injectable()
export class EditionsRepository {
  findParent(
    tx: TenantPrismaClient,
    organizationId: string,
    parentEventId: string,
  ): Promise<{ id: string; parentEventId: string | null } | null> {
    return tx.event.findFirst({
      where: { id: parentEventId, organizationId },
      select: { id: true, parentEventId: true },
    });
  }

  list(
    tx: TenantPrismaClient,
    organizationId: string,
    parentEventId: string,
    skip: number,
    take: number,
  ): Promise<[EventWithEditionCount[], number]> {
    const where = { organizationId, parentEventId };

    return Promise.all([
      tx.event.findMany({
        where,
        orderBy: { startsAt: 'desc' },
        skip,
        take,
        include: { _count: { select: { editions: true } } },
      }),
      tx.event.count({ where }),
    ]);
  }

  findById(
    tx: TenantPrismaClient,
    organizationId: string,
    parentEventId: string,
    editionId: string,
  ): Promise<EventWithModules | null> {
    return tx.event.findFirst({
      where: { id: editionId, organizationId, parentEventId },
      include: { modules: true },
    });
  }

  /**
   * Public URLs are /e/:eventSlug, so a slug is unique platform-wide. Row-level security
   * hides other organisations' events, so the check goes through a database function that
   * answers only "is this slug taken?" (migration events_global_slug).
   */
  async findSlugConflict(
    tx: TenantPrismaClient,
    _organizationId: string,
    slug: string,
  ): Promise<{ id: string } | null> {
    const rows = await tx.$queryRaw<{ taken: boolean }[]>`SELECT event_slug_taken(${slug}) AS taken`;
    return rows[0]?.taken ? { id: 'taken' } : null;
  }

  create(tx: TenantPrismaClient, data: CreateEditionData): Promise<EventWithModules> {
    return tx.event.create({
      data: {
        organizationId: data.organizationId,
        createdByUserId: data.createdByUserId,
        parentEventId: data.parentEventId,
        slug: data.slug,
        name: data.name,
        description: data.description,
        format: data.format,
        visibility: data.visibility,
        timeZone: data.timeZone,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        venueName: data.venueName,
        venueAddress: data.venueAddress,
        modules: {
          create: data.initialModuleKeys.map((moduleKey) => ({ moduleKey, enabled: true })),
        },
      },
      include: { modules: true },
    });
  }
}
