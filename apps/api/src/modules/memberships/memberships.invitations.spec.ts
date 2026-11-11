import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPABILITY_KEYS } from '@event-platform/shared';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { InvitationsService } from './invitations.service';
import { MembershipsRepository } from './memberships.repository';
import { MembershipsService } from './memberships.service';

const TENANT = {
  organizationId: 'org-1',
  userId: 'user-1',
  membershipId: 'member-1',
  permissions: [],
  capabilities: [],
};

function setup(options: { listRows?: unknown[]; removed?: number } = {}) {
  const transaction = {
    withTenant: vi.fn((work: (tx: unknown, tenant: unknown) => unknown) =>
      work({}, TENANT),
    ),
  };
  const repository = {
    listPendingInvitations: vi.fn().mockResolvedValue(options.listRows ?? []),
    revokeInvitation: vi.fn().mockResolvedValue(options.removed ?? 0),
  } as unknown as MembershipsRepository;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };

  const service = new MembershipsService(
    transaction as never,
    { getOrThrow: () => TENANT } as never,
    repository,
    audit as never,
  );

  return { service, repository, audit };
}

function invitationService(actorCapabilities: string[]) {
  const tenant = { ...TENANT, capabilities: actorCapabilities };
  const transaction = {
    withTenant: vi.fn((work: (tx: unknown, tenant: unknown) => unknown) =>
      work({}, tenant),
    ),
  };
  const repository = {
    findRole: vi.fn().mockResolvedValue({
      id: 'role-admin',
      key: 'organisation_admin',
      name: 'Administrator',
      permissions: [
        { permission: { key: 'workspace:read' } },
        { permission: { key: 'member:read' } },
        { permission: { key: 'member:manage' } },
      ],
    }),
    listOrganizationCapabilityKeys: vi
      .fn()
      .mockResolvedValue(Object.values(CAPABILITY_KEYS)),
    findUserByEmail: vi.fn().mockResolvedValue(null),
    findPendingInvitation: vi.fn().mockResolvedValue(null),
    createInvitation: vi.fn().mockResolvedValue({
      id: 'inv-1',
      email: 'person@example.test',
      expiresAt: new Date('2026-12-01T10:00:00.000Z'),
      role: { key: 'organisation_admin' },
    }),
  } as unknown as MembershipsRepository;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const email = { send: vi.fn().mockResolvedValue(undefined) };

  const service = new InvitationsService(
    transaction as never,
    { getOrThrow: () => tenant } as never,
    repository,
    audit as never,
    { get: () => 'http://localhost:5173' } as never,
    email as never,
  );

  return { service, repository, audit, email };
}

describe('InvitationsService escalation checks', () => {
  it('refuses to invite somebody into a role carrying capabilities the actor lacks', async () => {
    const { service, repository } = invitationService([
      CAPABILITY_KEYS.organizationInviteMembers,
    ]);

    await expect(
      service.invite({ email: 'person@example.test', roleId: 'role-admin' }),
    ).rejects.toMatchObject({ code: 'role_escalation_denied' });

    expect(repository.createInvitation).not.toHaveBeenCalled();
  });

  it('allows an administrator to invite into an administrator role', async () => {
    const { service, repository, email } = invitationService(
      Object.values(CAPABILITY_KEYS),
    );

    await expect(
      service.invite({ email: 'person@example.test', roleId: 'role-admin' }),
    ).resolves.toMatchObject({ roleKey: 'organisation_admin' });

    expect(repository.createInvitation).toHaveBeenCalled();
    expect(email.send).toHaveBeenCalled();
  });
});

describe('MembershipsService invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps pending invitations to the contract shape', async () => {
    const { service } = setup({
      listRows: [
        {
          id: 'inv-1',
          email: 'person@example.test',
          expiresAt: new Date('2026-12-01T10:00:00.000Z'),
          role: { key: 'event_manager' },
        },
      ],
    });

    await expect(service.listInvitations()).resolves.toEqual([
      {
        id: 'inv-1',
        email: 'person@example.test',
        roleKey: 'event_manager',
        expiresAt: '2026-12-01T10:00:00.000Z',
      },
    ]);
  });

  it('refuses to revoke an invitation that is gone, used or from another tenant', async () => {
    const { service, audit } = setup({ removed: 0 });

    await expect(service.revokeInvitation('inv-1')).rejects.toThrow();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('records the revocation once the invitation is actually removed', async () => {
    const { service, audit } = setup({ removed: 1 });

    await service.revokeInvitation('inv-1');

    expect(audit.record).toHaveBeenCalledWith({
      action: AUDIT_ACTIONS.invitationRevoked,
      targetType: 'invitation',
      targetId: 'inv-1',
    });
  });
});
