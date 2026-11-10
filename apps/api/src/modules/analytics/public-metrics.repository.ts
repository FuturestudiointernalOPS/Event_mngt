import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import type {
  CategoryRow,
  CategoryCountRow,
} from '../reports/reports.shapes';

export interface PublicParticipantStats {
  total: number;
  withOrganization: number;
  countries: number;
}

/**
 * Public aggregate queries (WP-20).
 *
 * These run inside the organisation scope resolved from the event slug. They return
 * counts only: no person row, email, phone or profile content is ever selected.
 */
@Injectable()
export class PublicMetricsRepository {
  approvedRegistrationCount(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<number> {
    return tx.registration.count({
      where: { organizationId, eventId, status: 'APPROVED' },
    });
  }

  approvedCategoryCounts(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<CategoryCountRow[]> {
    return tx.registration
      .groupBy({
        by: ['categoryId'],
        where: { organizationId, eventId, status: 'APPROVED' },
        _count: { _all: true },
      })
      .then((rows) =>
        rows.map((row) => ({ categoryId: row.categoryId, count: row._count._all })),
      );
  }

  listActiveCategories(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<CategoryRow[]> {
    return tx.participantCategory.findMany({
      where: { organizationId, eventId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
      select: { id: true, key: true, name: true, capacity: true },
    });
  }

  participantStats(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<PublicParticipantStats> {
    const where = {
      organizationId,
      registrations: { some: { organizationId, eventId, status: 'APPROVED' as const } },
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

  publicProfileCount(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<number> {
    return tx.participantProfile.count({
      where: {
        organizationId,
        eventId,
        moderationStatus: 'APPROVED',
        visibility: 'PUBLIC',
        registration: { status: 'APPROVED' },
      },
    });
  }

  publicInnovationCount(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<number> {
    return tx.innovation.count({
      where: {
        organizationId,
        eventId,
        moderationStatus: 'APPROVED',
        visibility: 'PUBLIC',
      },
    });
  }
}
