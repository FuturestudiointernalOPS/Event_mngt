import { describe, expect, it } from 'vitest';
import type { ListEventsQuery } from '@event-platform/shared';
import { buildListWhere, buildOrderBy } from './events.query';

function query(overrides: Partial<ListEventsQuery> = {}): ListEventsQuery {
  return { page: 1, pageSize: 20, ...overrides } as ListEventsQuery;
}

describe('buildOrderBy', () => {
  it('defaults to newest first', () => {
    expect(buildOrderBy(undefined)).toEqual({ startsAt: 'desc' });
  });

  it('accepts a whitelisted field, ascending by default', () => {
    expect(buildOrderBy('name')).toEqual({ name: 'asc' });
  });

  it('reads a leading dash as descending', () => {
    expect(buildOrderBy('-createdAt')).toEqual({ createdAt: 'desc' });
  });

  it('falls back instead of passing an unknown field to the query', () => {
    expect(buildOrderBy('description')).toEqual({ startsAt: 'desc' });
    expect(buildOrderBy('name; DROP TABLE events')).toEqual({ startsAt: 'desc' });
  });
});

describe('buildListWhere', () => {
  it('always filters by organisation', () => {
    expect(buildListWhere(query(), 'org-1')).toEqual({ organizationId: 'org-1' });
  });

  it('adds the requested filters', () => {
    const where = buildListWhere(
      query({ status: 'DRAFT', visibility: 'PRIVATE' }),
      'org-1',
    );

    expect(where).toEqual({
      organizationId: 'org-1',
      status: 'DRAFT',
      visibility: 'PRIVATE',
    });
  });

  it('searches names case-insensitively', () => {
    const where = buildListWhere(query({ search: 'salon' }), 'org-1');

    expect(where.name).toEqual({ contains: 'salon', mode: 'insensitive' });
  });
});
