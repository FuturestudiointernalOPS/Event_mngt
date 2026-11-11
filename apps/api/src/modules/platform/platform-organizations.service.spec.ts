import { describe, expect, it, vi } from 'vitest';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { PlatformOrganizationsService } from './platform-organizations.service';
import type { PlatformOrganizationsRepository } from './platform-organizations.repository';

const CREATED_AT = new Date('2026-11-01T10:00:00.000Z');
const UPDATED_AT = new Date('2026-11-10T10:00:00.000Z');

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org-1',
    slug: 'village',
    name: 'Village',
    status: 'ACTIVE' as const,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    _count: { capabilities: 38, members: 3, events: 2, registrations: 10 },
    ...overrides,
  };
}

function setup() {
  const tx = {};
  const tenantTransaction = {
    withPlatformSupport: vi.fn(
      async (
        _userId: string,
        callback: (client: unknown) => unknown,
      ) => callback(tx),
    ),
    withPlatformAdmin: vi.fn(
      async (
        _userId: string,
        callback: (client: unknown) => unknown,
      ) => callback(tx),
    ),
  };
  const repository = {
    findOwnerAccount: vi.fn(),
    listOverview: vi.fn(),
    findOverview: vi.fn(),
    findStatus: vi.fn(),
    updateStatus: vi.fn(),
    memberStatusCounts: vi.fn().mockResolvedValue({
      total: 3,
      active: 2,
      invited: 1,
      suspended: 0,
    }),
  };
  const provisioning = {
    provision: vi.fn().mockResolvedValue({
      organization: {
        id: 'org-1',
        slug: 'village',
        name: 'Village',
        status: 'ACTIVE',
        createdAt: CREATED_AT.toISOString(),
      },
      member: {
        id: 'member-1',
        roleId: 'role-1',
        roleKey: 'organisation_admin',
        status: 'ACTIVE',
      },
    }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new PlatformOrganizationsService(
    tenantTransaction as never,
    repository as unknown as PlatformOrganizationsRepository,
    provisioning as never,
    audit as never,
  );

  return { service, repository, provisioning, audit, tenantTransaction };
}

const QUERY = { page: 1, pageSize: 20 } as const;

describe('platform organisation overview', () => {
  it('returns a paginated portfolio with counts', async () => {
    const { service, repository } = setup();
    repository.listOverview.mockResolvedValue([[row()], 1]);

    const result = await service.overview(QUERY, 'admin-1');

    expect(result).toMatchObject({ page: 1, pageSize: 20, total: 1 });
    expect(result.items[0]).toMatchObject({
      id: 'org-1',
      capabilityCount: 38,
      memberCount: 3,
      eventCount: 2,
      registrationCount: 10,
    });
  });

  it('reads a support detail and audits the access', async () => {
    const { service, repository, audit } = setup();
    repository.findOverview.mockResolvedValue(row());

    const detail = await service.detail('org-1', 'admin-1');

    expect(detail.members).toEqual({
      total: 3,
      active: 2,
      invited: 1,
      suspended: 0,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.platformOrganizationViewed,
        organizationId: 'org-1',
        actorUserId: 'admin-1',
      }),
    );
  });

  it('does not reveal a missing organisation', async () => {
    const { service, repository } = setup();
    repository.findOverview.mockResolvedValue(null);

    await expect(service.detail('missing', 'admin-1')).rejects.toMatchObject({
      code: 'tenant_not_found',
    });
  });
});

describe('platform organisation creation', () => {
  const INPUT = {
    name: 'Village',
    timeZone: 'Africa/Porto-Novo',
    defaultLocale: 'fr' as const,
    ownerEmail: 'owner@example.test',
  };

  it('refuses an address with no account', async () => {
    const { service, repository } = setup();
    repository.findOwnerAccount.mockResolvedValue(null);

    await expect(service.create(INPUT, 'admin-1')).rejects.toMatchObject({
      code: 'owner_not_found',
    });
  });

  it('refuses an unverified owner', async () => {
    const { service, repository } = setup();
    repository.findOwnerAccount.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.test',
      status: 'PENDING_VERIFICATION',
      emailVerifiedAt: null,
    });

    await expect(service.create(INPUT, 'admin-1')).rejects.toMatchObject({
      code: 'owner_not_available',
    });
  });

  it('provisions the workspace with the owner as administrator', async () => {
    const { service, repository, provisioning } = setup();
    repository.findOwnerAccount.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.test',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    });
    repository.findOverview.mockResolvedValue(row());

    const detail = await service.create(INPUT, 'admin-1');

    expect(detail.id).toBe('org-1');
    expect(provisioning.provision).toHaveBeenCalledWith({
      name: 'Village',
      timeZone: 'Africa/Porto-Novo',
      defaultLocale: 'fr',
      ownerUserId: 'owner-1',
      actorUserId: 'admin-1',
    });
  });
});

describe('platform organisation status', () => {
  it('suspends through the platform scope and audits it', async () => {
    const { service, repository, audit } = setup();
    repository.findStatus.mockResolvedValue({ id: 'org-1', status: 'ACTIVE' });
    repository.updateStatus.mockResolvedValue(1);
    repository.findOverview.mockResolvedValue(row({ status: 'SUSPENDED' }));

    const detail = await service.updateStatus(
      'org-1',
      { status: 'SUSPENDED', reason: 'Unpaid invoice' },
      'admin-1',
    );

    expect(detail.status).toBe('SUSPENDED');
    expect(repository.updateStatus).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'SUSPENDED',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.organizationSuspended,
        organizationId: 'org-1',
        metadata: { status: 'SUSPENDED', reason: 'Unpaid invoice' },
      }),
    );
  });

  it('reactivates and audits the new status', async () => {
    const { service, repository, audit } = setup();
    repository.findStatus.mockResolvedValue({ id: 'org-1', status: 'SUSPENDED' });
    repository.updateStatus.mockResolvedValue(1);
    repository.findOverview.mockResolvedValue(row({ status: 'ACTIVE' }));

    await service.updateStatus('org-1', { status: 'ACTIVE' }, 'admin-1');

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.organizationReactivated,
      }),
    );
  });

  it('does not rewrite or audit an unchanged status', async () => {
    const { service, repository, audit } = setup();
    repository.findStatus.mockResolvedValue({ id: 'org-1', status: 'ACTIVE' });
    repository.findOverview.mockResolvedValue(row());

    const detail = await service.updateStatus('org-1', { status: 'ACTIVE' }, 'admin-1');

    expect(detail.status).toBe('ACTIVE');
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.organizationSuspended,
      }),
    );
  });

  it('refuses a missing organisation', async () => {
    const { service, repository } = setup();
    repository.findStatus.mockResolvedValue(null);

    await expect(
      service.updateStatus('missing', { status: 'SUSPENDED' }, 'admin-1'),
    ).rejects.toMatchObject({ code: 'tenant_not_found' });
  });
});
