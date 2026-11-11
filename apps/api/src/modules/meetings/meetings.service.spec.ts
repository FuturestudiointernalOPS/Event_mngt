import { describe, expect, it } from 'vitest';
import type {
  TenantPrismaClient,
  TenantTransactionService,
} from '../../database/tenant-transaction.service';
import type { ModuleRegistryService } from '../module-registry/module-registry.service';
import type {
  CreateMeetingData,
  MeetingProfileRow,
  MeetingRow,
  UpdateMeetingData,
} from './meetings.repository';
import type { MeetingsRepository } from './meetings.repository';
import { MeetingsService } from './meetings.service';

const TX = {} as TenantPrismaClient;
const TENANT = {
  organizationId: 'org-1',
  userId: 'user-1',
  membershipId: 'member-1',
  permissions: [],
};
const ACTIVE = new Set(['PROPOSED', 'ACCEPTED']);

function profile(id: string): MeetingProfileRow {
  return { id, registration: { person: { firstName: id, lastName: 'Test' } } };
}

function meeting(
  overrides: Partial<MeetingRow> & { id: string },
): MeetingRow {
  const proposer = overrides.proposerProfileId ?? 'profile-a';
  const recipient = overrides.recipientProfileId ?? 'profile-b';

  return {
    organizationId: 'org-1',
    eventId: 'event-1',
    proposerProfileId: proposer,
    recipientProfileId: recipient,
    status: 'PROPOSED',
    requiresStaffConfirmation: true,
    proposedAt: new Date('2026-01-01T10:00:00.000Z'),
    durationMinutes: 30,
    note: null,
    decidedAt: null,
    decidedByUserId: null,
    outcome: null,
    outcomeNotes: null,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    proposer: profile(proposer),
    recipient: profile(recipient),
    ...overrides,
  };
}

function harness(meetings: MeetingRow[] = []) {
  const store: MeetingRow[] = [...meetings];
  const updates: UpdateMeetingData[] = [];
  let sequence = 0;

  const repository = {
    eventExists: async () => ({ id: 'event-1' }),
    findEligibleProfiles: async (_tx: unknown, _o: string, _e: string, ids: string[]) =>
      ids.map(profile),
    findActiveForPair: async (
      _tx: unknown,
      _o: string,
      _e: string,
      first: string,
      second: string,
    ) =>
      store.find(
        (row) =>
          ACTIVE.has(row.status) &&
          ((row.proposerProfileId === first && row.recipientProfileId === second) ||
            (row.proposerProfileId === second && row.recipientProfileId === first)),
      ) ?? null,
    countActiveProposals: async (
      _tx: unknown,
      _o: string,
      _e: string,
      proposerProfileId: string,
    ) =>
      store.filter(
        (row) => ACTIVE.has(row.status) && row.proposerProfileId === proposerProfileId,
      ).length,
    create: async (_tx: unknown, data: CreateMeetingData) => {
      const row = meeting({
        id: `meeting-${++sequence}`,
        proposerProfileId: data.proposerProfileId,
        recipientProfileId: data.recipientProfileId,
        durationMinutes: data.durationMinutes,
        note: data.note,
        requiresStaffConfirmation: data.requiresStaffConfirmation,
      });
      store.push(row);
      return row;
    },
    find: async (_tx: unknown, _o: string, _e: string, meetingId: string) =>
      store.find((row) => row.id === meetingId) ?? null,
    update: async (
      _tx: unknown,
      _o: string,
      _e: string,
      meetingId: string,
      data: UpdateMeetingData,
    ) => {
      const index = store.findIndex((row) => row.id === meetingId);
      // Prisma ignores undefined members, so the fake must too.
      const changed = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
      );
      store[index] = { ...store[index], ...changed };
      updates.push(data);
      return store[index];
    },
    list: async (
      _tx: unknown,
      _o: string,
      _e: string,
      status: string | undefined,
      skip: number,
      take: number,
    ) => {
      const rows = status ? store.filter((row) => row.status === status) : store;
      return [rows.slice(skip, skip + take), rows.length] as [MeetingRow[], number];
    },
  } as unknown as MeetingsRepository;

  const modules = {
    requireEnabled: async () => undefined,
    requireEnabledSettings: async () => ({
      requiresStaffConfirmation: true,
      maxProposalsPerParticipant: 10,
    }),
  } as unknown as ModuleRegistryService;

  const tenantTransaction = {
    withTenant: async (
      callback: (tx: TenantPrismaClient, tenant: typeof TENANT) => unknown,
    ) => callback(TX, TENANT),
  } as unknown as TenantTransactionService;

  return {
    service: new MeetingsService(tenantTransaction, repository, modules),
    updates,
  };
}

describe('meeting lifecycle', () => {
  it('proposes, accepts and completes a meeting with an outcome', async () => {
    const { service } = harness();

    const proposed = await service.propose('event-1', {
      proposerProfileId: 'profile-a',
      recipientProfileId: 'profile-b',
      durationMinutes: 45,
    });
    expect(proposed).toMatchObject({
      status: 'PROPOSED',
      durationMinutes: 45,
      requiresStaffConfirmation: true,
    });

    const accepted = await service.update('event-1', proposed.id, {
      action: 'accept',
    });
    expect(accepted.status).toBe('ACCEPTED');

    const completed = await service.update('event-1', proposed.id, {
      action: 'complete',
      outcome: 'MET',
      notes: 'Productive',
    });
    expect(completed).toMatchObject({
      status: 'COMPLETED',
      outcome: 'MET',
      outcomeNotes: 'Productive',
    });
    expect(completed.decidedAt).not.toBeNull();

    const list = await service.list('event-1', { page: 1, pageSize: 10 });
    expect(list.total).toBe(1);
    expect(list.items[0].status).toBe('COMPLETED');
  });

  it('records the acting staff member and lists by status', async () => {
    const { service, updates } = harness([
      meeting({ id: 'meeting-1' }),
      meeting({ id: 'meeting-2', status: 'DECLINED', proposerProfileId: 'profile-c' }),
    ]);

    const declined = await service.list('event-1', {
      page: 1,
      pageSize: 10,
      status: 'DECLINED',
    });
    expect(declined.total).toBe(1);
    expect(declined.items[0].id).toBe('meeting-2');

    await service.update('event-1', 'meeting-1', { action: 'decline' });
    expect(updates[0].decidedByUserId).toBe('user-1');
    expect(updates[0].decidedAt).toBeInstanceOf(Date);
  });

  it('refuses to accept a meeting that is not proposed', async () => {
    const { service } = harness([
      meeting({ id: 'meeting-1', status: 'ACCEPTED' }),
    ]);

    await expect(
      service.update('event-1', 'meeting-1', { action: 'accept' }),
    ).rejects.toMatchObject({ code: 'invalid_transition' });
  });

  it('staff may accept on the recipient behalf (recipient-only rule deferred)', async () => {
    // There is no participant account link yet, so staff act for either party. The
    // participant slice will apply "only the recipient accepts or declines" with the
    // same transition helpers.
    const { service } = harness([meeting({ id: 'meeting-1' })]);

    const accepted = await service.update('event-1', 'meeting-1', {
      action: 'accept',
    });

    expect(accepted.status).toBe('ACCEPTED');
  });

  it('reports a meeting from another tenant as not found', async () => {
    const { service } = harness();

    await expect(
      service.update('event-1', 'foreign-meeting', { action: 'cancel' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
