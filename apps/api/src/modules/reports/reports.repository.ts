import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { BadgeStatus, type EventStatus } from '../../database/prisma-client';
import type {
  CategoryRow,
  ModerationCountRow,
  StatusCountRow,
} from './reports.shapes';
import type { TimelineRow } from './reports.rules';

export interface EventSummaryRow {
  id: string;
  name: string;
  slug: string;
  status: EventStatus;
  startsAt: Date;
  endsAt: Date;
}

export interface ParticipantStats {
  total: number;
  withOrganization: number;
  countries: number;
}

/**
 * Aggregates for one event (WP-18).
 *
 * Every statement carries the organisation and the event predicate. The daily timeline
 * is raw SQL because Prisma cannot group by `date_trunc`; it is parameterised and scoped
 * the same way as the typed queries.
 */
@Injectable()
export class ReportsRepository {
  findEvent(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<EventSummaryRow | null> {
    return tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        startsAt: true,
        endsAt: true,
      },
    });
  }

  statusCounts(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<StatusCountRow[]> {
    return tx.registration
      .groupBy({
        by: ['status'],
        where: { organizationId, eventId },
        _count: { _all: true },
      })
      .then((rows) =>
        rows.map((row) => ({ status: row.status, count: row._count._all })),
      );
  }

  sourceCounts(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<Array<{ source: 'PUBLIC' | 'STAFF' | 'IMPORT'; count: number }>> {
    return tx.registration
      .groupBy({
        by: ['source'],
        where: { organizationId, eventId },
        _count: { _all: true },
      })
      .then((rows) =>
        rows.map((row) => ({ source: row.source, count: row._count._all })),
      );
  }

  categoryCounts(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<Array<{ categoryId: string | null; count: number }>> {
    return tx.registration
      .groupBy({
        by: ['categoryId'],
        where: { organizationId, eventId },
        _count: { _all: true },
      })
      .then((rows) =>
        rows.map((row) => ({ categoryId: row.categoryId, count: row._count._all })),
      );
  }

  listCategories(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<CategoryRow[]> {
    return tx.participantCategory.findMany({
      where: { organizationId, eventId },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
      select: { id: true, key: true, name: true, capacity: true },
    });
  }

  participantStats(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<ParticipantStats> {
    const where = {
      organizationId,
      registrations: { some: { organizationId, eventId } },
    };

    return Promise.all([
      tx.person.count({ where }),
      tx.person.count({ where: { ...where, organizationName: { not: null } } }),
      tx.person.groupBy({ by: ['country'], where, _count: { _all: true } }),
    ]).then(([total, withOrganization, countries]) => ({
      total,
      withOrganization,
      countries: countries.filter((row) => row.country !== null && row.country !== '')
        .length,
    }));
  }

  profileCounts(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<ModerationCountRow[]> {
    return tx.participantProfile
      .groupBy({
        by: ['moderationStatus'],
        where: { organizationId, eventId },
        _count: { _all: true },
      })
      .then((rows) =>
        rows.map((row) => ({
          moderationStatus: row.moderationStatus,
          count: row._count._all,
        })),
      );
  }

  innovationCounts(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<ModerationCountRow[]> {
    return tx.innovation
      .groupBy({
        by: ['moderationStatus'],
        where: { organizationId, eventId },
        _count: { _all: true },
      })
      .then((rows) =>
        rows.map((row) => ({
          moderationStatus: row.moderationStatus,
          count: row._count._all,
        })),
      );
  }

  badgeCounts(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<Array<{ status: BadgeStatus; count: number }>> {
    return tx.badge
      .groupBy({
        by: ['status'],
        where: { organizationId, eventId },
        _count: { _all: true },
      })
      .then((rows) =>
        rows.map((row) => ({ status: row.status, count: row._count._all })),
      );
  }

  submittedSince(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    since: Date,
  ): Promise<number> {
    return tx.registration.count({
      where: { organizationId, eventId, submittedAt: { gte: since } },
    });
  }

  /** Daily counts. `date_trunc` keeps the aggregate in the database. */
  timeline(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    since: Date,
  ): Promise<TimelineRow[]> {
    return tx.$queryRaw<TimelineRow[]>`
      SELECT date_trunc('day', submitted_at) AS day, count(*)::int AS count
      FROM registrations
      WHERE organization_id = ${organizationId}::uuid
        AND event_id = ${eventId}::uuid
        AND submitted_at >= ${since}
      GROUP BY 1
      ORDER BY 1
    `;
  }
}
