import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { MembershipsRepository } from './memberships.repository';
import { MembershipsService } from './memberships.service';

const TENANT = { organizationId: 'org-1' };

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
    repository,
    audit as never,
  );

  return { service, repository, audit };
}

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
