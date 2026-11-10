import { describe, expect, it } from 'vitest';
import type { CreateEditionRequest } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import type { TenantTransactionService } from '../../database/tenant-transaction.service';
import { EventStatus, EventVisibility, EventFormat } from '../../database/prisma-client';
import type { EventWithModules } from './events.mapper';
import type { EditionsRepository } from './editions.repository';
import { EditionsService } from './editions.service';

const TENANT = { organizationId: 'org-1', userId: 'user-1' };

function eventRow(overrides: Partial<EventWithModules> = {}): EventWithModules {
  const now = new Date('2026-11-09T10:00:00.000Z');

  return {
    id: 'edition-1',
    organizationId: 'org-1',
    parentEventId: 'parent-1',
    slug: 'village-2027',
    name: 'Village 2027',
    description: null,
    format: EventFormat.IN_PERSON,
    status: EventStatus.DRAFT,
    visibility: EventVisibility.PRIVATE,
    timeZone: 'UTC',
    startsAt: now,
    endsAt: new Date('2026-11-10T10:00:00.000Z'),
    venueName: null,
    venueAddress: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    publishedAt: null,
    createdByUserId: 'user-1',
    createdAt: now,
    updatedAt: now,
    modules: [],
    ...overrides,
  };
}

function input(overrides: Partial<CreateEditionRequest> = {}): CreateEditionRequest {
  return {
    name: 'Village 2027',
    slug: 'village-2027',
    format: 'IN_PERSON',
    visibility: 'PRIVATE',
    timeZone: 'UTC',
    startsAt: '2026-11-10T09:00:00.000Z',
    endsAt: '2026-11-10T18:00:00.000Z',
    ...overrides,
  } as CreateEditionRequest;
}

interface Fakes {
  service: EditionsService;
  created: unknown[];
  parent: (value: { id: string; parentEventId: string | null } | null) => void;
  slug: (value: { id: string } | null) => void;
}

function build(): Fakes {
  let parent: { id: string; parentEventId: string | null } | null = {
    id: 'parent-1',
    parentEventId: null,
  };
  let slug: { id: string } | null = null;
  const created: unknown[] = [];

  const repository = {
    findParent: async () => parent,
    findSlugConflict: async () => slug,
    create: async (_tx: unknown, data: unknown) => {
      created.push(data);
      return eventRow();
    },
    list: async () => [[], 0],
    findById: async () => null,
  } as unknown as EditionsRepository;

  const tenantTransaction = {
    withTenant: async (callback: (tx: unknown, tenant: typeof TENANT) => Promise<unknown>) =>
      callback({}, TENANT),
  } as unknown as TenantTransactionService;

  return {
    service: new EditionsService(tenantTransaction, repository),
    created,
    parent: (value) => {
      parent = value;
    },
    slug: (value) => {
      slug = value;
    },
  };
}

describe('EditionsService.create', () => {
  it('creates an edition under a top-level parent', async () => {
    const fakes = build();

    const result = await fakes.service.create('parent-1', input(), 'user-1');

    expect(result.parentEventId).toBe('parent-1');
    expect(fakes.created[0]).toMatchObject({
      parentEventId: 'parent-1',
      organizationId: 'org-1',
      initialModuleKeys: ['core', 'reporting'],
    });
  });

  it('refuses an edition of an edition', async () => {
    const fakes = build();
    fakes.parent({ id: 'parent-1', parentEventId: 'grandparent-1' });

    await expect(fakes.service.create('parent-1', input(), 'user-1')).rejects.toMatchObject({
      code: 'invalid_reference',
    });
  });

  it('reports a foreign parent as not found', async () => {
    const fakes = build();
    fakes.parent(null);

    await expect(fakes.service.create('other-tenant', input(), 'user-1')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('refuses a duplicate slug in the same organisation', async () => {
    const fakes = build();
    fakes.slug({ id: 'existing' });

    await expect(fakes.service.create('parent-1', input(), 'user-1')).rejects.toMatchObject({
      code: 'slug_taken',
    });
  });

  it('inherits nothing: an edition without a venue has none', async () => {
    const fakes = build();

    await fakes.service.create('parent-1', input(), 'user-1');

    expect(fakes.created[0]).toMatchObject({ venueName: null, venueAddress: null });
  });
});

describe('EditionsService.list', () => {
  it('reports a foreign parent as not found', async () => {
    const fakes = build();
    fakes.parent(null);

    await expect(
      fakes.service.list('other-tenant', { page: 1, pageSize: 20 }),
    ).rejects.toBeInstanceOf(AppException);
  });
});
