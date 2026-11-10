import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import type {
  ParticipantCategory,
  Person,
  Prisma,
  Registration,
} from '../../database/prisma-client';

export type PersonWithCount = Person & { _count: { registrations: number } };

export type PersonWithRegistrations = Person & {
  registrations: Array<Registration & { category: ParticipantCategory | null }>;
};

/**
 * People for one event. A person row is organisation-scoped, so the event membership
 * comes from their registrations; every query carries both predicates.
 */
@Injectable()
export class ParticipantsRepository {
  eventExists(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<{ id: string } | null> {
    return tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true },
    });
  }

  list(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    search: string | undefined,
    skip: number,
    take: number,
  ): Promise<[PersonWithCount[], number]> {
    const where: Prisma.PersonWhereInput = {
      organizationId,
      registrations: { some: { eventId, organizationId } },
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    return Promise.all([
      tx.person.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take,
        include: {
          _count: {
            select: { registrations: { where: { eventId, organizationId } } },
          },
        },
      }),
      tx.person.count({ where }),
    ]);
  }

  find(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    personId: string,
  ): Promise<PersonWithRegistrations | null> {
    return tx.person.findFirst({
      where: {
        id: personId,
        organizationId,
        registrations: { some: { eventId, organizationId } },
      },
      include: {
        registrations: {
          where: { eventId, organizationId },
          orderBy: { submittedAt: 'desc' },
          include: { category: true },
        },
      },
    });
  }
}
