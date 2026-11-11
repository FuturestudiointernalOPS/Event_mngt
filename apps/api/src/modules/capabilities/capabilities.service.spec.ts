import { describe, expect, it, vi } from 'vitest';
import { CAPABILITY_KEYS } from '@event-platform/shared';
import { CapabilitiesService } from './capabilities.service';
import { PlatformCapabilitiesService } from './platform-capabilities.service';

const TENANT: {
  organizationId: string;
  userId: string;
  membershipId: string;
  permissions: string[];
  capabilities: string[];
} = {
  organizationId: 'org-1',
  userId: 'user-1',
  membershipId: 'member-1',
  permissions: [],
  capabilities: Object.values(CAPABILITY_KEYS),
};

function baseMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    userId: 'user-1',
    status: 'ACTIVE',
    user: { email: 'person@example.test', displayName: 'Person' },
    role: {
      id: 'role-1',
      key: 'event_manager',
      name: 'Event Manager',
      permissions: [{ permission: { key: 'event:read' } }],
    },
    capabilities: [],
    ...overrides,
  };
}

function setup(options: {
  organizationCapabilities?: string[];
  actorCapabilities?: string[];
  member?: unknown;
  otherAdministrators?: number;
  removeMemberResult?: number;
  removeOrganizationResult?: number;
} = {}) {
  const transaction = {} as never;
  const tenant = {
    ...TENANT,
    capabilities: options.actorCapabilities ?? Object.values(CAPABILITY_KEYS),
  };
  const repository = {
    findOrganization: vi.fn().mockResolvedValue({
      id: 'org-1',
      slug: 'workspace',
      name: 'Workspace',
      status: 'ACTIVE',
    }),
    listOrganizations: vi.fn().mockResolvedValue([
      {
        id: 'org-1',
        slug: 'workspace',
        name: 'Workspace',
        status: 'ACTIVE',
        _count: { capabilities: 2 },
      },
    ]),
    listOrganizationCapabilityKeys: vi
      .fn()
      .mockResolvedValue(options.organizationCapabilities ?? []),
    findMember: vi.fn().mockResolvedValue(options.member ?? baseMember()),
    addOrganizationCapabilities: vi.fn().mockResolvedValue(undefined),
    removeOrganizationCapability: vi
      .fn()
      .mockResolvedValue(options.removeOrganizationResult ?? 1),
    addMemberCapabilities: vi.fn().mockResolvedValue(undefined),
    removeMemberCapability: vi.fn().mockResolvedValue(options.removeMemberResult ?? 1),
    countOtherAdministrators: vi.fn().mockResolvedValue(options.otherAdministrators ?? 1),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const tenantTransaction = {
    withTenant: async (callback: (tx: never, tenant: typeof TENANT) => unknown) =>
      callback(transaction, tenant),
    withOrganizationScope: async (_id: string, callback: (tx: never) => unknown) =>
      callback(transaction),
    withPlatformAdmin: async (_id: string, callback: (tx: never) => unknown) =>
      callback(transaction),
  };
  const tenantContext = {
    get: () => tenant,
    getOrThrow: () => tenant,
  };
  const service = new CapabilitiesService(
    tenantTransaction as never,
    tenantContext as never,
    repository as never,
    audit as never,
  );
  const platformService = new PlatformCapabilitiesService(
    tenantTransaction as never,
    repository as never,
    audit as never,
  );

  return { service, platformService, repository, audit };
}

describe('organization capability management', () => {
  it('stores a capability with its prerequisites and audits the assignment', async () => {
    const { platformService, repository, audit } = setup();

    await platformService.assignOrganizationCapability(
      'org-1',
      CAPABILITY_KEYS.eventsPublish,
      'platform-admin-1',
    );

    expect(repository.addOrganizationCapabilities).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      expect.arrayContaining([CAPABILITY_KEYS.eventsPublish, CAPABILITY_KEYS.eventsView]),
      'platform-admin-1',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'organization.capability.assigned',
        organizationId: 'org-1',
      }),
    );
  });

  it('audits a revocation only when a row was actually removed', async () => {
    const { platformService, audit } = setup({ removeOrganizationResult: 0 });

    await platformService.revokeOrganizationCapability(
      'org-1',
      CAPABILITY_KEYS.eventsView,
      'platform-admin-1',
    );

    expect(audit.record).not.toHaveBeenCalled();
  });

  it('reports platform organisations with their entitlement count', async () => {
    const { platformService } = setup();

    await expect(platformService.listOrganizations('platform-admin-1')).resolves.toEqual([
      {
        id: 'org-1',
        slug: 'workspace',
        name: 'Workspace',
        status: 'ACTIVE',
        capabilityCount: 2,
      },
    ]);
  });
});

describe('member capability management', () => {
  it('refuses a capability the organisation is not entitled to', async () => {
    const { service, repository } = setup({
      organizationCapabilities: [CAPABILITY_KEYS.organizationView],
    });

    await expect(
      service.assignMemberCapability('member-1', CAPABILITY_KEYS.eventsCreate),
    ).rejects.toMatchObject({ code: 'capability_not_entitled' });

    expect(repository.addMemberCapabilities).not.toHaveBeenCalled();
  });

  it('scopes every lookup to the tenant, never to a client-supplied organisation', async () => {
    const { service, repository } = setup({
      organizationCapabilities: [CAPABILITY_KEYS.eventsView, CAPABILITY_KEYS.eventsCreate],
    });

    await service.assignMemberCapability('member-1', CAPABILITY_KEYS.eventsCreate);

    expect(repository.findMember).toHaveBeenCalledWith(expect.anything(), 'org-1', 'member-1');
    expect(repository.addMemberCapabilities).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'member-1',
      expect.any(Array),
      'user-1',
    );
  });

  it('grants prerequisites together with the requested capability', async () => {
    const { service, repository } = setup({
      organizationCapabilities: [
        CAPABILITY_KEYS.eventsView,
        CAPABILITY_KEYS.eventsPublish,
      ],
    });

    await service.assignMemberCapability('member-1', CAPABILITY_KEYS.eventsPublish);

    expect(repository.addMemberCapabilities).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'member-1',
      expect.arrayContaining([CAPABILITY_KEYS.eventsPublish, CAPABILITY_KEYS.eventsView]),
      'user-1',
    );
  });

  it('refuses to grant a capability the actor does not hold', async () => {
    const { service, repository } = setup({
      organizationCapabilities: [
        CAPABILITY_KEYS.eventsView,
        CAPABILITY_KEYS.eventsCreate,
        CAPABILITY_KEYS.eventsPublish,
      ],
      actorCapabilities: [CAPABILITY_KEYS.eventsView, CAPABILITY_KEYS.eventsCreate],
    });

    await expect(
      service.assignMemberCapability('member-1', CAPABILITY_KEYS.eventsPublish),
    ).rejects.toMatchObject({ code: 'capability_escalation_denied' });

    expect(repository.addMemberCapabilities).not.toHaveBeenCalled();
  });

  it('will not remove the last administrative grant', async () => {
    const member = baseMember({
      role: {
        id: 'role-1',
        key: 'viewer',
        name: 'Viewer',
        permissions: [{ permission: { key: 'workspace:read' } }],
      },
      capabilities: [
        { capabilityKey: CAPABILITY_KEYS.organizationViewMembers },
        { capabilityKey: CAPABILITY_KEYS.organizationManagePermissions },
      ],
    });
    const { service, repository } = setup({
      organizationCapabilities: [
        CAPABILITY_KEYS.organizationView,
        CAPABILITY_KEYS.organizationViewMembers,
        CAPABILITY_KEYS.organizationManagePermissions,
      ],
      member,
      otherAdministrators: 0,
    });

    await expect(
      service.revokeMemberCapability(
        'member-1',
        CAPABILITY_KEYS.organizationManagePermissions,
      ),
    ).rejects.toMatchObject({ code: 'last_administrator' });

    expect(repository.removeMemberCapability).not.toHaveBeenCalled();
  });
});

describe('central authorization helper', () => {
  it('denies by default when the request has no resolved capability set', () => {
    const { service } = setup({ actorCapabilities: [] });

    expect(service.hasCapability(CAPABILITY_KEYS.eventsView)).toBe(false);
    expect(() => service.requireCapability(CAPABILITY_KEYS.eventsView)).toThrowError();
  });
});
