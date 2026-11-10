import { describe, expect, it } from 'vitest';
import type {
  TenantPrismaClient,
  TenantTransactionService,
} from '../../database/tenant-transaction.service';
import type { ModuleRegistryService } from '../module-registry/module-registry.service';
import type {
  CreateIntroductionData,
  IntroductionProfileRow,
  IntroductionRequestRow,
  TransitionIntroductionData,
} from './introductions.repository';
import type { IntroductionsRepository } from './introductions.repository';
import { IntroductionsService } from './introductions.service';

const TX = {} as TenantPrismaClient;
const TENANT = {
  organizationId: 'org-1',
  userId: 'user-1',
  membershipId: 'member-1',
  permissions: [],
};

const PROFILE: IntroductionProfileRow = {
  id: 'profile-a',
  registration: { person: { firstName: 'Amina', lastName: 'Dossou' } },
};

interface StoredRequest {
  row: IntroductionRequestRow;
  history: Array<{
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string | null;
    note: string | null;
  }>;
}

function storedRequest(
  id: string,
  overrides: Partial<IntroductionRequestRow> = {},
): StoredRequest {
  return {
    row: {
      id,
      organizationId: 'org-1',
      eventId: 'event-1',
      requestingProfileId: 'profile-a',
      reason: 'Looking for a partner',
      offeredHelp: null,
      status: 'REQUESTED',
      assignedToUserId: null,
      decidedAt: null,
      decidedByUserId: null,
      outcome: null,
      outcomeNotes: null,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T10:00:00.000Z'),
      requestingProfile: PROFILE,
      ...overrides,
    },
    history: [],
  };
}

function harness(options: {
  settings?: Record<string, unknown>;
  requests?: StoredRequest[];
} = {}) {
  const store: StoredRequest[] = options.requests ?? [];
  let sequence = 0;

  const repository = {
    eventExists: async () => ({ id: 'event-1' }),
    findEligibleProfile: async () => PROFILE,
    findMemberWithPermission: async () => ({ id: 'member-user-2' }),
    createWithHistory: async (
      _tx: unknown,
      data: CreateIntroductionData,
      actorUserId: string,
    ) => {
      const entry = storedRequest(`introduction-${++sequence}`, {
        requestingProfileId: data.requestingProfileId,
        reason: data.reason,
        offeredHelp: data.offeredHelp,
        status: data.status,
        assignedToUserId: data.assignedToUserId,
      });
      store.push(entry);
      entry.history.push({ fromStatus: null, toStatus: data.status, actorUserId, note: null });
      return entry.row;
    },
    transition: async (_tx: unknown, input: TransitionIntroductionData) => {
      const entry = store.find((item) => item.row.id === input.requestId);
      if (!entry) {
        throw new Error('request missing');
      }
      const changed = Object.fromEntries(
        Object.entries(input.data).filter(([, value]) => value !== undefined),
      );
      entry.row = { ...entry.row, ...changed };
      entry.history.push({
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        actorUserId: input.actorUserId,
        note: input.note,
      });
      return entry.row;
    },
    findRequest: async (_tx: unknown, _o: string, _e: string, requestId: string) =>
      store.find((item) => item.row.id === requestId)?.row ?? null,
    findDetail: async (_tx: unknown, _o: string, _e: string, requestId: string) => {
      const entry = store.find((item) => item.row.id === requestId);
      if (!entry) {
        return null;
      }
      const statusHistory = entry.history.map((item, index) => ({
        ...item,
        id: `history-${index}`,
        organizationId: 'org-1',
        eventId: 'event-1',
        requestId,
        createdAt: new Date(Date.parse('2026-01-01T10:00:00.000Z') + index * 1000),
      }));
      return { ...entry.row, statusHistory };
    },
    list: async (
      _tx: unknown,
      _o: string,
      _e: string,
      status: string | undefined,
      skip: number,
      take: number,
    ) => {
      const rows = store.map((item) => item.row);
      const filtered = status ? rows.filter((row) => row.status === status) : rows;
      return [filtered.slice(skip, skip + take), filtered.length] as [
        IntroductionRequestRow[],
        number,
      ];
    },
  } as unknown as IntroductionsRepository;

  const modules = {
    requireEnabled: async () => undefined,
    requireEnabledSettings: async () =>
      options.settings ?? { requireReason: true, autoAssign: false },
  } as unknown as ModuleRegistryService;

  const tenantTransaction = {
    withTenant: async (
      callback: (tx: TenantPrismaClient, tenant: typeof TENANT) => unknown,
    ) => callback(TX, TENANT),
  } as unknown as TenantTransactionService;

  return {
    service: new IntroductionsService(tenantTransaction, repository, modules),
    store,
  };
}

describe('introduction workflow', () => {
  it('records, assigns and introduces a request with its full history', async () => {
    const { service } = harness();

    const request = await service.create('event-1', {
      requestingProfileId: 'profile-a',
      reason: 'Looking for a manufacturing partner',
    });
    expect(request).toMatchObject({
      status: 'REQUESTED',
      reason: 'Looking for a manufacturing partner',
    });

    const assigned = await service.update('event-1', request.id, {
      action: 'assign',
      assignedToUserId: 'user-2',
    });
    expect(assigned).toMatchObject({
      status: 'ASSIGNED',
      assignedToUserId: 'user-2',
    });

    const introduced = await service.update('event-1', request.id, {
      action: 'introduce',
      outcome: 'CONNECTED',
      notes: 'Introduced by email',
    });
    expect(introduced).toMatchObject({
      status: 'INTRODUCED',
      outcome: 'CONNECTED',
      outcomeNotes: 'Introduced by email',
    });
    expect(introduced.decidedAt).not.toBeNull();

    const detail = await service.detail('event-1', request.id);
    expect(detail.history.map((entry) => [entry.fromStatus, entry.toStatus])).toEqual([
      [null, 'REQUESTED'],
      ['REQUESTED', 'ASSIGNED'],
      ['ASSIGNED', 'INTRODUCED'],
    ]);
    expect(detail.history.every((entry) => entry.actorUserId === 'user-1')).toBe(true);
  });

  it('declines from ASSIGNED and appends exactly one row per transition', async () => {
    const { service, store } = harness();

    const request = await service.create('event-1', {
      requestingProfileId: 'profile-a',
      reason: 'A reason',
    });
    await service.update('event-1', request.id, {
      action: 'decline',
      outcome: 'NO_MATCH',
      notes: 'Nothing suitable',
    });

    expect(store[0].history).toHaveLength(2);
    expect(store[0].history[1]).toEqual({
      fromStatus: 'REQUESTED',
      toStatus: 'DECLINED',
      actorUserId: 'user-1',
      note: 'Nothing suitable',
    });
    expect(store[0].row.outcome).toBe('NO_MATCH');
  });

  it('auto-assigns a staff-created request to its creator, or queues it otherwise', async () => {
    const auto = harness({ settings: { requireReason: false, autoAssign: true } });

    const assigned = await auto.service.create('event-1', {
      requestingProfileId: 'profile-a',
    });

    expect(assigned).toMatchObject({
      status: 'ASSIGNED',
      assignedToUserId: 'user-1',
    });
    expect(auto.store[0].history).toEqual([
      { fromStatus: null, toStatus: 'ASSIGNED', actorUserId: 'user-1', note: null },
    ]);

    const manual = harness();
    const queued = await manual.service.create('event-1', {
      requestingProfileId: 'profile-a',
      reason: 'A reason',
    });

    expect(queued.status).toBe('REQUESTED');
    expect(queued.assignedToUserId).toBeNull();
  });

  it('lists the queue and filters by status', async () => {
    const { service } = harness({
      requests: [
        storedRequest('introduction-1'),
        storedRequest('introduction-2', { status: 'ASSIGNED' }),
      ],
    });

    const assigned = await service.list('event-1', {
      page: 1,
      pageSize: 10,
      status: 'ASSIGNED',
    });

    expect(assigned.total).toBe(1);
    expect(assigned.items[0].id).toBe('introduction-2');
  });
});
