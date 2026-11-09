import { Injectable } from '@nestjs/common';
import type { ListRegistrationsQuery } from '@event-platform/shared';
import { Prisma } from '../../database/prisma-client';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { REGISTRATION_SELECT, type RegistrationRow } from './registrations.mapper';

/** Staff-facing registration queries: filtered, searched and paginated lists. */
@Injectable()
export class RegistrationsRepository {
  list(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    query: ListRegistrationsQuery,
  ): Promise<[RegistrationRow[], number]> {
    const where: Prisma.RegistrationWhereInput = {
      organizationId,
      eventId,
      ...(query.status && { status: query.status }),
      ...(query.categoryKey && { category: { key: query.categoryKey } }),
      ...(query.search && {
        person: {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' } },
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      }),
    };

    return Promise.all([
      tx.registration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: REGISTRATION_SELECT,
      }),
      tx.registration.count({ where }),
    ]);
  }

  findDetail(tx: TenantPrismaClient, organizationId: string, eventId: string, id: string) {
    return tx.registration.findFirst({
      where: { id, eventId, organizationId },
      select: {
        ...REGISTRATION_SELECT,
        consents: {
          select: { purpose: true, policyVersion: true, granted: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }
}
