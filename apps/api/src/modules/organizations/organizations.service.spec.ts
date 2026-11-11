import { describe, expect, it, vi } from 'vitest';
import { OrganizationsService } from './organizations.service';
import type { OrganizationsRepository } from './organizations.repository';

const RESULT = {
  organization: {
    id: 'org-1',
    slug: 'village',
    name: 'Village',
    status: 'ACTIVE' as const,
    createdAt: '2026-11-10T10:00:00.000Z',
  },
  member: {
    id: 'member-1',
    roleId: 'role-1',
    roleKey: 'organisation_admin',
    status: 'ACTIVE' as const,
  },
};

function setup() {
  const repository = {
    findAccount: vi.fn(),
  };
  const provisioning = { provision: vi.fn().mockResolvedValue(RESULT) };
  const service = new OrganizationsService(
    repository as unknown as OrganizationsRepository,
    provisioning as never,
  );

  return { service, repository, provisioning };
}

const INPUT = {
  name: 'Village',
  timeZone: 'Africa/Porto-Novo',
  defaultLocale: 'fr' as const,
};

describe('self-service onboarding', () => {
  it('provisions a workspace and makes the caller its administrator', async () => {
    const { service, repository, provisioning } = setup();
    repository.findAccount.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.test',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    });

    await expect(service.createForAccount(INPUT, 'user-1')).resolves.toBe(RESULT);

    expect(provisioning.provision).toHaveBeenCalledWith({
      name: 'Village',
      timeZone: 'Africa/Porto-Novo',
      defaultLocale: 'fr',
      ownerUserId: 'user-1',
      actorUserId: 'user-1',
    });
  });

  it('passes a requested slug through', async () => {
    const { service, repository, provisioning } = setup();
    repository.findAccount.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.test',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    });

    await service.createForAccount({ ...INPUT, slug: 'mon-village' }, 'user-1');

    expect(provisioning.provision).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'mon-village' }),
    );
  });

  it('refuses a suspended account', async () => {
    const { service, repository } = setup();
    repository.findAccount.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.test',
      status: 'SUSPENDED',
      emailVerifiedAt: new Date(),
    });

    await expect(service.createForAccount(INPUT, 'user-1')).rejects.toMatchObject({
      code: 'account_suspended',
    });
  });

  it('refuses an account that has not verified its address', async () => {
    const { service, repository } = setup();
    repository.findAccount.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.test',
      status: 'PENDING_VERIFICATION',
      emailVerifiedAt: null,
    });

    await expect(service.createForAccount(INPUT, 'user-1')).rejects.toMatchObject({
      code: 'email_not_verified',
    });
  });

  it('refuses a missing account', async () => {
    const { service, repository } = setup();
    repository.findAccount.mockResolvedValue(null);

    await expect(service.createForAccount(INPUT, 'user-1')).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });
});
