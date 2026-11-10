import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import type { EventRow, EventStatusCountRow } from './reports.rules';

export interface EventLocationRow {
  id: string;
  parentEventId: string | null;
  name: string;
  slug: string;
}

/**
 * Aggregates across events (WP-18): the organisation portfolio and an edition family.
 *
 * Kept apart from the single-event repository so each file stays one responsibility.
 * Both always include the organisation predicate.
 */
@Injectable()
export class ReportsPortfolioRepository {
  findEventLocation(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<EventLocationRow | null> {
    return tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true, parentEventId: true, name: true, slug: true },
    });
  }

  eventsForOrganization(
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<EventRow[]> {
    return tx.event.findMany({
      where: { organizationId },
      orderBy: [{ startsAt: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        startsAt: true,
        parentEventId: true,
      },
    });
  }

  organizationStatusCounts(
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<EventStatusCountRow[]> {
    return this.groupStatus(tx, { organizationId });
  }

  /**
   * The root plus its direct editions. The service resolves the root first so calling
   * the route with an edition id returns the same family as calling it with the parent.
   */
  editionFamily(
    tx: TenantPrismaClient,
    organizationId: string,
    rootId: string,
  ): Promise<EventRow[]> {
    return tx.event.findMany({
      where: {
        organizationId,
        OR: [{ id: rootId }, { parentEventId: rootId }],
      },
      orderBy: [{ startsAt: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        startsAt: true,
        parentEventId: true,
      },
    });
  }

  eventStatusCounts(
    tx: TenantPrismaClient,
    organizationId: string,
    eventIds: string[],
  ): Promise<EventStatusCountRow[]> {
    return this.groupStatus(tx, { organizationId, eventId: { in: eventIds } });
  }

  private groupStatus(
    tx: TenantPrismaClient,
    where: { organizationId: string; eventId?: string | { in: string[] } },
  ): Promise<EventStatusCountRow[]> {
    return tx.registration
      .groupBy({
        by: ['eventId', 'status'],
        where,
        _count: { _all: true },
      })
      .then((rows) =>
        rows.map((row) => ({
          eventId: row.eventId,
          status: row.status,
          count: row._count._all,
        })),
      );
  }
}
