import { describe, expect, it } from 'vitest';
import type { TenantPrismaClient, TenantTransactionService } from '../../database/tenant-transaction.service';
import {
  RegistrationSource,
  RegistrationStatus,
  type Badge,
  type Person,
} from '../../database/prisma-client';
import type { AuditService } from '../../common/audit/audit.service';
import type { BadgesService, IssuedBadgeNotice } from '../badges/badges.service';
import type { RegistrationDetailRow } from './registrations.mapper';
import type { RegistrationsRepository } from './registrations.repository';
import { RegistrationsService } from './registrations.service';

const TX = {} as TenantPrismaClient;
const TENANT = {
  organizationId: 'org-1',
  userId: 'user-1',
  membershipId: 'member-1',
  permissions: [],
};

function personRow(): Person {
  return {
    id: 'person-1',
    organizationId: 'org-1',
    email: 'amina@example.test',
    firstName: 'Amina',
    lastName: 'Dossou',
    phone: null,
    organizationName: null,
    jobTitle: null,
    country: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function badgeRow(overrides: Partial<Badge> = {}): Badge {
  return {
    id: 'badge-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    registrationId: 'registration-1',
    tokenHash: 'hash',
    status: 'ISSUED',
    issuedAt: new Date('2026-11-10T12:00:00.000Z'),
    revokedAt: null,
    reissuedAt: null,
    reissueCount: 0,
    createdAt: new Date('2026-11-10T12:00:00.000Z'),
    updatedAt: new Date('2026-11-10T12:00:00.000Z'),
    ...overrides,
  };
}

function detailRow(
  status: RegistrationStatus,
  overrides: Partial<RegistrationDetailRow> = {},
): RegistrationDetailRow {
  const decidedAt = new Date('2026-11-10T12:00:00.000Z');

  return {
    id: 'registration-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    personId: 'person-1',
    categoryId: null,
    reference: 'EP-ABCDEF',
    status,
    source: RegistrationSource.PUBLIC,
    submittedAt: new Date('2026-11-10T10:00:00.000Z'),
    decidedAt,
    decidedByUserId: 'user-1',
    decisionReason: null,
    createdAt: new Date('2026-11-10T10:00:00.000Z'),
    updatedAt: decidedAt,
    person: personRow(),
    category: null,
    answers: [],
    consents: [],
    badge: null,
    ...overrides,
  };
}

interface Options {
  status?: RegistrationStatus | null;
}

function harness(options: Options = {}) {
  const status = options.status === undefined ? RegistrationStatus.PENDING : options.status;
  const decisions: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  let issueCalls = 0;
  let notifications = 0;

  const repository = {
    findStatus: async () =>
      status === null ? null : { id: 'registration-1', status },
    decide: async (
      _tx: unknown,
      _organizationId: string,
      _eventId: string,
      _registrationId: string,
      data: Record<string, unknown>,
    ) => {
      decisions.push(data);
      return detailRow(data.status as RegistrationStatus, {
        decisionReason: (data.decisionReason as string | null) ?? null,
      });
    },
    // The database row after issuance: the badge exists even though the update that
    // changed the status ran before it was created.
    findDetail: async () =>
      detailRow(RegistrationStatus.APPROVED, { badge: badgeRow() }),
  } as unknown as RegistrationsRepository;

  const badges = {
    issueForApproved: async () => {
      issueCalls += 1;
      return {
        badge: {
          id: 'badge-1',
          registrationId: 'registration-1',
          reference: 'EP-ABCDEF',
          status: 'ISSUED',
          issuedAt: '2026-11-10T12:00:00.000Z',
          revokedAt: null,
          reissueCount: 0,
        },
        token: 'token',
        recipient: { email: 'amina@example.test', name: 'Amina Dossou' },
        event: { name: 'Village 2026', slug: 'village-2026' },
      } as IssuedBadgeNotice;
    },
    notifyIssued: async () => {
      notifications += 1;
    },
  } as unknown as BadgesService;

  const audit = {
    record: async (entry: Record<string, unknown>) => {
      audits.push(entry);
    },
  } as unknown as AuditService;

  const tenantTransaction = {
    withTenant: async (
      callback: (tx: TenantPrismaClient, tenant: typeof TENANT) => unknown,
    ) => callback(TX, TENANT),
  } as unknown as TenantTransactionService;

  return {
    service: new RegistrationsService(tenantTransaction, repository, badges, audit),
    decisions,
    audits,
    counters: {
      get issueCalls() {
        return issueCalls;
      },
      get notifications() {
        return notifications;
      },
    },
  };
}

describe('approval workflow', () => {
  it('approves a pending registration, records the decider and issues a badge', async () => {
    const { service, decisions, audits, counters } = harness();

    const detail = await service.approve('event-1', 'registration-1', {
      reason: 'Payment confirmed',
    });

    expect(detail.status).toBe('APPROVED');
    expect(detail.badge?.status).toBe('ISSUED');
    expect(decisions[0]).toMatchObject({
      status: RegistrationStatus.APPROVED,
      decidedByUserId: 'user-1',
      decisionReason: 'Payment confirmed',
    });
    expect(decisions[0].decidedAt).toBeInstanceOf(Date);
    expect(counters.issueCalls).toBe(1);
    expect(counters.notifications).toBe(1);
    expect(audits[0]).toMatchObject({
      action: 'registration.approved',
      targetType: 'registration',
      targetId: 'registration-1',
    });
  });

  it('refuses a second approval without touching the row', async () => {
    const { service, decisions, audits } = harness({
      status: RegistrationStatus.APPROVED,
    });

    await expect(
      service.approve('event-1', 'registration-1', {}),
    ).rejects.toMatchObject({ code: 'conflict' });

    expect(decisions).toEqual([]);
    expect(audits).toEqual([]);
  });

  it('rejects without issuing a badge', async () => {
    const { service, decisions, audits, counters } = harness();

    const detail = await service.reject('event-1', 'registration-1', {
      reason: 'Not eligible',
    });

    expect(detail.status).toBe('REJECTED');
    expect(decisions[0]).toMatchObject({
      status: RegistrationStatus.REJECTED,
      decisionReason: 'Not eligible',
    });
    expect(counters.issueCalls).toBe(0);
    expect(audits[0].action).toBe('registration.rejected');
  });

  it('reports a registration from another tenant as not found', async () => {
    const { service } = harness({ status: null });

    await expect(
      service.approve('event-1', 'foreign-registration', {}),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
