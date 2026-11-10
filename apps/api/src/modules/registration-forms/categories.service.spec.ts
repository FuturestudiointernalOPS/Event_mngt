import { describe, expect, it } from 'vitest';
import type { CreateCategoryRequest } from '@event-platform/shared';
import type {
  TenantPrismaClient,
  TenantTransactionService,
} from '../../database/tenant-transaction.service';
import { CategoriesService } from './categories.service';
import type {
  CategoryWithCount,
  RegistrationFormsRepository,
} from './registration-forms.repository';

const TX = {} as TenantPrismaClient;

function categoryRow(overrides: Partial<CategoryWithCount> = {}): CategoryWithCount {
  return {
    id: 'category-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    key: 'startup',
    name: 'Startup',
    description: null,
    capacity: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    _count: { registrations: 0 },
    ...overrides,
  };
}

function harness(existing: CategoryWithCount[] = []) {
  const created: Array<Record<string, unknown>> = [];
  const repository = {
    eventExists: async () => ({ id: 'event-1' }),
    listCategories: async () => existing,
    findCategory: async () => existing[0] ?? null,
    createCategory: async (_tx: unknown, data: Record<string, unknown>) => {
      created.push(data);
      return categoryRow({ key: String(data.key), name: String(data.name) });
    },
    updateCategory: async () => categoryRow({ name: 'Renamed' }),
  } as unknown as RegistrationFormsRepository;

  const tenantTransaction = {
    withTenant: async (
      callback: (tx: TenantPrismaClient, tenant: { organizationId: string }) => unknown,
    ) => callback(TX, { organizationId: 'org-1' }),
  } as unknown as TenantTransactionService;

  return {
    service: new CategoriesService(tenantTransaction, repository),
    created,
  };
}

function input(overrides: Partial<CreateCategoryRequest> = {}): CreateCategoryRequest {
  return { name: 'Startup', sortOrder: 0, ...overrides };
}

describe('categories service', () => {
  it('derives a key from the name when none is given', async () => {
    const { service, created } = harness();

    await service.create('event-1', input({ name: 'Étudiant' }));

    expect(created[0].key).toBe('etudiant');
  });

  it('avoids a collision by adding a suffix', async () => {
    const { service, created } = harness([
      categoryRow({ key: 'startup' }),
      categoryRow({ key: 'startup-2' }),
    ]);

    await service.create('event-1', input());

    expect(created[0].key).toBe('startup-3');
  });

  it('refuses an explicit key that already exists', async () => {
    const { service } = harness([categoryRow({ key: 'startup' })]);

    await expect(
      service.create('event-1', input({ key: 'startup' })),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('reports another tenant category as not found on update', async () => {
    const repository = {
      findCategory: async () => null,
    } as unknown as RegistrationFormsRepository;
    const tenantTransaction = {
      withTenant: async (
        callback: (tx: TenantPrismaClient, tenant: { organizationId: string }) => unknown,
      ) => callback(TX, { organizationId: 'org-1' }),
    } as unknown as TenantTransactionService;

    const service = new CategoriesService(tenantTransaction, repository);

    await expect(
      service.update('event-1', 'foreign-category', { name: 'Nope' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
