import type { ListEventsQuery } from '@event-platform/shared';
import type { Prisma } from '../../database/prisma-client';

/**
 * Query shaping for event listings, kept pure and separate from the repository so the
 * rules can be tested without a database or the generated client (R11).
 */

const SORTABLE_FIELDS = new Set(['name', 'startsAt', 'endsAt', 'createdAt', 'status']);

const DEFAULT_SORT = { startsAt: 'desc' } as const;

/** Sorting is a whitelist: an unknown field falls back, it never reaches the query. */
export function buildOrderBy(sort: string | undefined): Prisma.EventOrderByWithRelationInput {
  if (!sort) {
    return DEFAULT_SORT;
  }

  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;

  if (!SORTABLE_FIELDS.has(field)) {
    return DEFAULT_SORT;
  }

  return { [field]: descending ? 'desc' : 'asc' } as Prisma.EventOrderByWithRelationInput;
}

/** Every tenant-owned listing is filtered by organisation first, then by the request. */
export function buildListWhere(
  query: ListEventsQuery,
  organizationId: string,
): Prisma.EventWhereInput {
  const where: Prisma.EventWhereInput = { organizationId };

  if (query.status) {
    where.status = query.status;
  }
  if (query.visibility) {
    where.visibility = query.visibility;
  }
  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' };
  }

  return where;
}
