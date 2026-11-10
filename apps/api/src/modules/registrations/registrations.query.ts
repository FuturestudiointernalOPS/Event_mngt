import type { ListRegistrationsQuery } from '@event-platform/shared';
import type { Prisma } from '../../database/prisma-client';

/**
 * Staff list shaping, kept pure so the filter rules are testable (R11).
 * Organisation and event are always part of the predicate, never optional.
 */

export function buildListWhere(
  query: ListRegistrationsQuery,
  organizationId: string,
  eventId: string,
): Prisma.RegistrationWhereInput {
  const where: Prisma.RegistrationWhereInput = { organizationId, eventId };

  if (query.status) {
    where.status = query.status;
  }

  if (query.categoryKey) {
    where.category = { organizationId, eventId, key: query.categoryKey };
  }

  if (query.search) {
    where.OR = [
      { reference: { contains: query.search, mode: 'insensitive' } },
      { person: { email: { contains: query.search, mode: 'insensitive' } } },
      { person: { firstName: { contains: query.search, mode: 'insensitive' } } },
      { person: { lastName: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  return where;
}

export const REGISTRATION_ORDER: Prisma.RegistrationOrderByWithRelationInput = {
  submittedAt: 'desc',
};
