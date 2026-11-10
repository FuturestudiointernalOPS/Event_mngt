import { describe, expect, it } from 'vitest';
import type { TenantPrismaClient, TenantTransactionService } from '../../database/tenant-transaction.service';
import type { OrganizationProfile } from '../../database/prisma-client';
import type { OrganizationProfileRepository } from './organization-profile.repository';
import { OrganizationProfileService } from './organization-profile.service';

const TX = {} as TenantPrismaClient;
const TENANT = {
  organizationId: 'org-1',
  userId: 'user-1',
  membershipId: 'member-1',
  permissions: [],
};

function row(overrides: Partial<OrganizationProfile> = {}): OrganizationProfile {
  return {
    id: 'org-profile-1',
    organizationId: 'org-1',
    name: 'Innovation Village',
    description: null,
    websiteUrl: null,
    logoUrl: null,
    contactEmail: null,
    country: null,
    sector: null,
    visibility: 'PUBLIC',
    moderationStatus: 'PENDING',
    submittedAt: new Date('2026-11-10T10:00:00.000Z'),
    moderatedAt: null,
    moderatedByUserId: null,
    moderationNote: null,
    createdAt: new Date('2026-11-10T10:00:00.000Z'),
    updatedAt: new Date('2026-11-10T10:00:00.000Z'),
    ...overrides,
  };
}

function harness(existing: OrganizationProfile | null = null) {
  let current = existing;
  const created: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];

  const repository = {
    find: async () => current,
    create: async (_tx: unknown, organizationId: string, content: Record<string, unknown>) => {
      created.push({ organizationId, ...content });
      current = row({ name: String(content.name) });
      return current;
    },
    update: async (_tx: unknown, _organizationId: string, content: Record<string, unknown>) => {
      updates.push(content);
      current = row({ ...current, ...content } as Partial<OrganizationProfile>);
      return current;
    },
  } as unknown as OrganizationProfileRepository;

  const tenantTransaction = {
    withTenant: async (
      callback: (tx: TenantPrismaClient, tenant: typeof TENANT) => unknown,
    ) => callback(TX, TENANT),
  } as unknown as TenantTransactionService;

  return {
    service: new OrganizationProfileService(tenantTransaction, repository),
    created,
    updates,
  };
}

describe('organization profile', () => {
  it('returns null before the workspace creates one', async () => {
    await expect(harness().service.get()).resolves.toBeNull();
  });

  it('creates the listing pending review with public visibility', async () => {
    const { service, created } = harness();

    const profile = await service.upsert({ name: 'Innovation Village' });

    expect(created[0]).toMatchObject({
      organizationId: 'org-1',
      name: 'Innovation Village',
      visibility: 'PUBLIC',
      moderationStatus: 'PENDING',
    });
    expect(created[0].submittedAt).toBeInstanceOf(Date);
    expect(profile.moderationStatus).toBe('PENDING');
  });

  it('returns an approved listing to review on edit and clears the moderator', async () => {
    const { service, updates } = harness(
      row({ moderationStatus: 'APPROVED', moderatedByUserId: 'user-9' }),
    );

    await service.upsert({ name: 'Innovation Village', description: 'Updated' });
    await service.upsert({ name: 'Innovation Village' });

    expect(updates).toHaveLength(2);
    expect(updates[1]).toMatchObject({
      moderationStatus: 'PENDING',
      moderatedAt: null,
      moderatedByUserId: null,
      moderationNote: null,
    });
  });

  it('refuses to approve a listing that was not submitted', async () => {
    const { service } = harness(row({ moderationStatus: 'DRAFT' }));

    await expect(
      service.moderate({ decision: 'APPROVED' }),
    ).rejects.toMatchObject({ code: 'invalid_status_transition' });
  });

  it('is not found when there is nothing to moderate', async () => {
    await expect(
      harness().service.moderate({ decision: 'APPROVED' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
