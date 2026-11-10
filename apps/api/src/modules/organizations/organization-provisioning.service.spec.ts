import { describe, expect, it, vi } from 'vitest';
import { ORGANIZATION_CAPABILITY_KEYS } from '@event-platform/shared';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { OrganizationProvisioningService } from './organization-provisioning.service';
import type { OrganizationsRepository } from './organizations.repository';
import { rolePermissionKeys, roleProvisioningPlans } from './organizations.rules';

const CREATED_AT = new Date('2026-11-10T10:00:00.000Z');

function setup() {
  const tx = {};
  const tenantTransaction = {
    withOrganizationProvisioning: vi.fn(
      async (
        _organizationId: string,
        _actorUserId: string,
        callback: (client: unknown) => unknown,
      ) => callback(tx),
    ),
  };
  const repository = {
    findPermissionsByKeys: vi.fn(),
    slugExists: vi.fn().mockResolvedValue(null),
    createOrganization: vi.fn(),
    createWorkspaceDefaults: vi.fn().mockResolvedValue(undefined),
    createEntitlements: vi.fn().mockResolvedValue(undefined),
    createSystemRoles: vi.fn(),
    createMembership: vi.fn(),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new OrganizationProvisioningService(
    tenantTransaction as never,
    repository as unknown as OrganizationsRepository,
    audit as never,
  );

  repository.findPermissionsByKeys.mockImplementation(
    async (_tx: unknown, keys: string[]) =>
      keys.map((key) => ({ id: `permission-${key}`, key })),
  );
  repository.createOrganization.mockImplementation(
    async (_tx: unknown, data: { id: string; slug: string; name: string }) => ({
      id: data.id,
      slug: data.slug,
      name: data.name,
      status: 'ACTIVE',
      createdAt: CREATED_AT,
    }),
  );
  repository.createSystemRoles.mockImplementation(
    async (_tx: unknown, _organizationId: string, plans: Array<{ key: string; name: string }>) =>
      new Map(plans.map((plan) => [plan.key, { id: `role-${plan.key}`, ...plan }])),
  );
  repository.createMembership.mockResolvedValue({
    id: 'member-1',
    roleId: 'role-organisation_admin',
    status: 'ACTIVE',
  });

  return { service, repository, tenantTransaction, audit };
}

const INPUT = {
  name: 'Innovation Village',
  timeZone: 'Africa/Porto-Novo',
  defaultLocale: 'fr' as const,
  ownerUserId: 'user-owner',
  actorUserId: 'user-actor',
};

describe('organisation provisioning', () => {
  it('creates the organisation, defaults, roles and first administrator in one tenant scope', async () => {
    const { service, repository, tenantTransaction, audit } = setup();

    const result = await service.provision(INPUT);

    expect(result.organization.slug).toBe('innovation-village');
    expect(result.organization.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(result.member).toMatchObject({
      id: 'member-1',
      roleKey: 'organisation_admin',
      status: 'ACTIVE',
    });

    expect(tenantTransaction.withOrganizationProvisioning).toHaveBeenCalledWith(
      result.organization.id,
      'user-actor',
      expect.any(Function),
    );
    expect(repository.createOrganization).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: result.organization.id,
        slug: 'innovation-village',
        name: 'Innovation Village',
      }),
    );
    expect(repository.createWorkspaceDefaults).toHaveBeenCalledWith(
      expect.anything(),
      result.organization.id,
      { timeZone: 'Africa/Porto-Novo', defaultLocale: 'fr' },
    );
    expect(repository.createEntitlements).toHaveBeenCalledWith(
      expect.anything(),
      result.organization.id,
      [...ORGANIZATION_CAPABILITY_KEYS],
      'user-actor',
    );
    expect(repository.createSystemRoles).toHaveBeenCalledWith(
      expect.anything(),
      result.organization.id,
      roleProvisioningPlans(),
      expect.any(Map),
    );
    expect(repository.createMembership).toHaveBeenCalledWith(expect.anything(), {
      organizationId: result.organization.id,
      userId: 'user-owner',
      roleId: 'role-organisation_admin',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.organizationCreated,
        organizationId: result.organization.id,
        actorUserId: 'user-actor',
      }),
    );
  });

  it('uses a caller-provided slug', async () => {
    const { service, repository } = setup();

    await service.provision({ ...INPUT, slug: 'mon-village' });

    expect(repository.createOrganization).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ slug: 'mon-village' }),
    );
  });

  it('refuses a slug that is already taken', async () => {
    const { service, repository } = setup();
    repository.slugExists.mockResolvedValue({ id: 'another-org' });

    await expect(service.provision({ ...INPUT, slug: 'taken' })).rejects.toMatchObject({
      code: 'slug_taken',
    });
    expect(repository.createOrganization).not.toHaveBeenCalled();
  });

  it('derives a free slug when the name is taken', async () => {
    const { service, repository } = setup();
    repository.slugExists.mockImplementation(async (_tx: unknown, slug: string) =>
      slug === 'innovation-village' ? { id: 'another-org' } : null,
    );

    const result = await service.provision(INPUT);

    expect(result.organization.slug).toBe('innovation-village-2');
  });

  it('fails clearly when the permission catalogue is incomplete', async () => {
    const { service, repository } = setup();
    repository.findPermissionsByKeys.mockImplementation(
      async (_tx: unknown, keys: string[]) =>
        keys
          .filter((key) => key !== 'workspace:manage')
          .map((key) => ({ id: `permission-${key}`, key })),
    );

    await expect(service.provision(INPUT)).rejects.toMatchObject({
      code: 'organization_setup_failed',
    });
    expect(repository.createOrganization).not.toHaveBeenCalled();
  });

  it('turns a database unique violation into a slug conflict', async () => {
    const { service, repository } = setup();
    repository.createOrganization.mockRejectedValue({ code: 'P2002' });

    await expect(service.provision(INPUT)).rejects.toMatchObject({
      code: 'slug_taken',
    });
  });

  it('connects every role template permission', async () => {
    const { service, repository } = setup();

    await service.provision(INPUT);

    const keys = rolePermissionKeys(roleProvisioningPlans());
    expect(repository.findPermissionsByKeys).toHaveBeenCalledWith(
      expect.anything(),
      keys,
    );
  });
});
