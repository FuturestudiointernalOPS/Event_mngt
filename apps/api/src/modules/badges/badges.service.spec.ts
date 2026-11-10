import { describe, expect, it } from 'vitest';
import type { EmailMessage, EmailPort } from '../../integrations/email/email.port';
import type {
  TenantPrismaClient,
  TenantTransactionService,
} from '../../database/tenant-transaction.service';
import { RegistrationStatus } from '../../database/prisma-client';
import { hashBadgeToken } from './badge.tokens';
import type {
  BadgeRegistration,
  BadgeWithReference,
  BadgesRepository,
} from './badges.repository';
import { BadgesService } from './badges.service';

const TX = {} as TenantPrismaClient;

function badgeRow(overrides: Partial<BadgeWithReference> = {}): BadgeWithReference {
  return {
    id: 'badge-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    registrationId: 'registration-1',
    tokenHash: hashBadgeToken('previous-token'),
    status: 'ISSUED',
    issuedAt: new Date('2026-11-01T00:00:00.000Z'),
    revokedAt: null,
    reissuedAt: null,
    reissueCount: 0,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    registration: { reference: 'IV26-0001' },
    ...overrides,
  };
}

function registrationRow(
  overrides: Partial<BadgeRegistration> = {},
): BadgeRegistration {
  return {
    id: 'registration-1',
    eventId: 'event-1',
    status: RegistrationStatus.APPROVED,
    reference: 'IV26-0001',
    person: { email: 'amina@example.test', firstName: 'Amina', lastName: 'Dossou' },
    event: { name: 'Village 2026', slug: 'village-2026' },
    ...overrides,
  };
}

interface HarnessOptions {
  registration?: BadgeRegistration | null;
  badge?: BadgeWithReference | null;
}

function harness(options: HarnessOptions = {}) {
  let badge = options.badge ?? null;
  const registration =
    options.registration === undefined ? registrationRow() : options.registration;
  const created: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const emails: EmailMessage[] = [];

  const repository = {
    eventExists: async () => ({ id: 'event-1' }),
    findRegistration: async () => registration,
    findBadge: async () => badge,
    create: async (_tx: unknown, data: Record<string, unknown>) => {
      created.push(data);
      badge = badgeRow({ tokenHash: String(data.tokenHash) });
      return badge;
    },
    update: async (
      _tx: unknown,
      _organizationId: string,
      _badgeId: string,
      data: Record<string, unknown>,
    ) => {
      updates.push(data);
      const current = badge ?? badgeRow();
      const increment = data.reissueCount as { increment: number } | undefined;

      badge = badgeRow({
        ...current,
        tokenHash: (data.tokenHash as string | undefined) ?? current.tokenHash,
        status: (data.status as typeof current.status | undefined) ?? current.status,
        issuedAt: (data.issuedAt as Date | undefined) ?? current.issuedAt,
        revokedAt:
          data.revokedAt === undefined ? current.revokedAt : (data.revokedAt as Date | null),
        reissuedAt:
          data.reissuedAt === undefined
            ? current.reissuedAt
            : (data.reissuedAt as Date | null),
        reissueCount: increment
          ? current.reissueCount + increment.increment
          : current.reissueCount,
      });

      return badge;
    },
    list: async () => [[badge as BadgeWithReference], 1],
  } as unknown as BadgesRepository;

  const tenantTransaction = {
    withTenant: async (
      callback: (tx: TenantPrismaClient, tenant: { organizationId: string }) => unknown,
    ) => callback(TX, { organizationId: 'org-1' }),
  } as unknown as TenantTransactionService;

  const email: EmailPort = {
    send: async (message) => {
      emails.push(message);
    },
  };

  return {
    service: new BadgesService(tenantTransaction, repository, email),
    created,
    updates,
    emails,
    getBadge: () => badge,
  };
}

describe('badge issuance', () => {
  it('stores only the hash and returns a token that matches it', async () => {
    const { service, created, emails } = harness();

    const notice = await service.issueForApproved(TX, 'org-1', 'event-1', 'registration-1');

    expect(created).toHaveLength(1);
    expect(notice.token).not.toBeNull();
    expect(created[0].tokenHash).toBe(hashBadgeToken(notice.token as string));
    expect(created[0].tokenHash).not.toBe(notice.token);
    expect(notice.badge.reference).toBe('IV26-0001');
    expect(emails).toHaveLength(0);
  });

  it('is idempotent for an approved registration that already has a badge', async () => {
    const { service, created } = harness({ badge: badgeRow() });

    const notice = await service.issueForApproved(TX, 'org-1', 'event-1', 'registration-1');

    expect(created).toHaveLength(0);
    expect(notice.token).toBeNull();
    expect(notice.badge.id).toBe('badge-1');
  });

  it('refuses a registration that is not approved', async () => {
    const { service } = harness({
      registration: registrationRow({ status: RegistrationStatus.PENDING }),
    });

    await expect(
      service.issueForApproved(TX, 'org-1', 'event-1', 'registration-1'),
    ).rejects.toMatchObject({ code: 'invalid_status_transition' });
  });

  it('reports another tenant registration as not found', async () => {
    const { service } = harness({ registration: null });

    await expect(
      service.issueForApproved(TX, 'org-1', 'event-1', 'registration-1'),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('sends the badge code once and never throws on a provider failure', async () => {
    const { service } = harness();
    const notice = await service.issueForApproved(TX, 'org-1', 'event-1', 'registration-1');

    const failing: BadgesService = new BadgesService(
      {} as TenantTransactionService,
      {} as BadgesRepository,
      {
        send: async () => {
          throw new Error('provider down');
        },
      },
    );

    await expect(failing.notifyIssued(notice)).resolves.toBeUndefined();
  });
});

describe('badge lifecycle', () => {
  it('rotates the token on reissue and notifies the participant', async () => {
    const { service, updates, emails } = harness({ badge: badgeRow() });

    const issued = await service.reissue('event-1', 'registration-1');

    expect(updates[0].tokenHash).toBe(hashBadgeToken(issued.token));
    expect(updates[0].tokenHash).not.toBe(hashBadgeToken('previous-token'));
    expect((updates[0].reissueCount as { increment: number }).increment).toBe(1);
    expect(issued.reissueCount).toBe(1);
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe('amina@example.test');
    expect(emails[0].text).toContain(issued.token);
  });

  it('revokes without deleting the row', async () => {
    const { service, updates } = harness({ badge: badgeRow() });

    const revoked = await service.revoke('event-1', 'registration-1');

    expect(revoked.status).toBe('REVOKED');
    expect(updates[0].status).toBe('REVOKED');
    expect(updates[0].revokedAt).toBeInstanceOf(Date);
  });

  it('refuses to reissue when no badge exists', async () => {
    const { service } = harness({ badge: null });

    await expect(service.reissue('event-1', 'registration-1')).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});

describe('badge reads', () => {
  it('never includes a token in a list', async () => {
    const { service } = harness({ badge: badgeRow() });

    const page = await service.list('event-1', { page: 1, pageSize: 20 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).not.toHaveProperty('token');
    expect(page.total).toBe(1);
  });

  it('returns null when an approved registration has no badge yet', async () => {
    const { service } = harness({ badge: null });

    await expect(
      service.getForRegistration('event-1', 'registration-1'),
    ).resolves.toBeNull();
  });
});
