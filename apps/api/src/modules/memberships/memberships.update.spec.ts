import { describe, expect, it, vi } from 'vitest';
import { CAPABILITY_KEYS } from '@event-platform/shared';
import { MembershipsRepository } from './memberships.repository';
import { MembershipsService } from './memberships.service';

const TENANT = {
  organizationId: 'org-1',
  userId: 'user-1',
  membershipId: 'member-1',
  capabilities: Object.values(CAPABILITY_KEYS),
  permissions: [],
};

function member(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    status: 'ACTIVE',
    joinedAt: null,
    user: { id: 'user-1', email: 'person@example.test', displayName: 'Person' },
    role: {
      id: 'role-admin',
      key: 'organisation_admin',
      name: 'Administrator',
      permissions: [{ permission: { key: 'member:manage' } }],
    },
    capabilities: [],
    ...overrides,
  };
}

function setup(
  options: {
    member?: unknown;
    otherAdministrators?: number;
    actorCapabilities?: string[];
    organizationCapabilities?: string[];
  } = {},
) {
  const tenant = {
    ...TENANT,
    capabilities: options.actorCapabilities ?? TENANT.capabilities,
  };
  const transaction = {
    withTenant: vi.fn((work: (tx: unknown, tenant: unknown) => unknown) => work({}, tenant)),
  };
  const repository = {
    findMember: vi.fn().mockResolvedValue(options.member ?? member()),
    findRole: vi.fn().mockResolvedValue({
      id: 'role-viewer',
      key: 'viewer',
      name: 'Viewer',
      permissions: [{ permission: { key: 'event:read' } }],
    }),
    listOrganizationCapabilityKeys: vi.fn().mockResolvedValue(
      options.organizationCapabilities ?? Object.values(CAPABILITY_KEYS),
    ),
    countOtherAdministrators: vi.fn().mockResolvedValue(options.otherAdministrators ?? 1),
    updateRole: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  } as unknown as MembershipsRepository;
  const tenantContext = { getOrThrow: () => tenant };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };

  return {
    service: new MembershipsService(
      transaction as never,
      tenantContext as never,
      repository,
      audit as never,
    ),
    repository,
    audit,
  };
}

describe('MembershipsService member updates', () => {
  it('suspends a member and records the new status', async () => {
    const { service, repository, audit } = setup();

    const updated = await service.updateMember('member-1', { status: 'SUSPENDED' });

    expect(updated.status).toBe('SUSPENDED');
    expect(repository.updateStatus).toHaveBeenCalledWith(expect.anything(), 'member-1', 'SUSPENDED');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: 'member-1', metadata: { status: 'SUSPENDED' } }),
    );
  });

  it('refuses to suspend the last administrator', async () => {
    const { service } = setup({ otherAdministrators: 0 });

    await expect(service.updateMember('member-1', { status: 'SUSPENDED' })).rejects.toThrow();
  });

  it('allows suspending an administrator while another one remains', async () => {
    const { service } = setup({ otherAdministrators: 1 });

    await expect(service.updateMember('member-1', { status: 'SUSPENDED' })).resolves.toMatchObject({
      status: 'SUSPENDED',
    });
  });

  it('never suspends a membership that was only invited', async () => {
    const { service } = setup({ member: member({ status: 'INVITED' }) });

    await expect(service.updateMember('member-1', { status: 'SUSPENDED' })).rejects.toThrow();
  });

  it('changes the role without touching the status', async () => {
    const { service, repository } = setup();

    const updated = await service.updateMember('member-1', { roleId: 'role-viewer' });

    expect(repository.updateRole).toHaveBeenCalledWith(expect.anything(), 'member-1', 'role-viewer');
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(updated.roleId).toBe('role-viewer');
  });

  it('refuses a role that belongs to another workspace', async () => {
    const { service, repository } = setup();
    vi.mocked(repository.findRole).mockResolvedValue(null);

    await expect(service.updateMember('member-1', { roleId: 'role-other' })).rejects.toThrow();
  });

  it('refuses to assign a role carrying capabilities the actor does not hold', async () => {
    const { service, repository } = setup({
      actorCapabilities: [CAPABILITY_KEYS.organizationManagePermissions],
      organizationCapabilities: [
        CAPABILITY_KEYS.organizationManagePermissions,
        CAPABILITY_KEYS.eventsView,
      ],
    });

    await expect(
      service.updateMember('member-1', { roleId: 'role-viewer' }),
    ).rejects.toMatchObject({ code: 'role_escalation_denied' });

    expect(repository.updateRole).not.toHaveBeenCalled();
  });
});
