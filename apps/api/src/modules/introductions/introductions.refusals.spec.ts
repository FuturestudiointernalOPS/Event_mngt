import { describe, expect, it } from 'vitest';
import type {
  TenantPrismaClient,
  TenantTransactionService,
} from '../../database/tenant-transaction.service';
import { AppException } from '../../common/app-exception';
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
  history: number;
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
    history: 0,
  };
}

interface Options {
  moduleEnabled?: boolean;
  settings?: Record<string, unknown>;
  eligibleProfiles?: string[];
  members?: string[];
  requests?: StoredRequest[];
}

function harness(options: Options = {}) {
  const eligible = options.eligibleProfiles ?? ['profile-a'];
  const members = options.members ?? ['user-1', 'user-2'];
  const store: StoredRequest[] = options.requests ?? [];
  let sequence = 0;

  const repository = {
    findEligibleProfile: async (
      _tx: unknown,
      _o: string,
      _e: string,
      profileId: string,
    ) => (eligible.includes(profileId) ? PROFILE : null),
    findMemberWithPermission: async (_tx: unknown, _o: string, userId: string) =>
      members.includes(userId) ? { id: `member-${userId}` } : null,
    createWithHistory: async (
      _tx: unknown,
      data: CreateIntroductionData,
    ) => {
      const entry = storedRequest(`introduction-${++sequence}`, {
        requestingProfileId: data.requestingProfileId,
        reason: data.reason,
        offeredHelp: data.offeredHelp,
        status: data.status,
        assignedToUserId: data.assignedToUserId,
      });
      store.push(entry);
      entry.history += 1;
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
      entry.history += 1;
      return entry.row;
    },
    findRequest: async (_tx: unknown, _o: string, _e: string, requestId: string) =>
      store.find((item) => item.row.id === requestId)?.row ?? null,
    findDetail: async (_tx: unknown, _o: string, _e: string, requestId: string) => {
      const entry = store.find((item) => item.row.id === requestId);
      return entry ? { ...entry.row, statusHistory: [] } : null;
    },
  } as unknown as IntroductionsRepository;

  const modules = {
    requireEnabled: async () => {
      if (options.moduleEnabled === false) {
        throw AppException.unprocessable(
          'module_not_enabled',
          'The "introductions" module is not enabled for this event.',
        );
      }
    },
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

describe('introduction refusals', () => {
  it('refuses a request without a reason when requireReason is on', async () => {
    const { service } = harness();

    await expect(
      service.create('event-1', { requestingProfileId: 'profile-a' }),
    ).rejects.toMatchObject({ code: 'reason_required' });
  });

  it('accepts an empty reason when requireReason is off', async () => {
    const { service } = harness({
      settings: { requireReason: false, autoAssign: false },
    });

    const request = await service.create('event-1', {
      requestingProfileId: 'profile-a',
    });

    expect(request.reason).toBeNull();
  });

  it('refuses an assignee outside the organisation', async () => {
    const { service, store } = harness({
      requests: [storedRequest('introduction-1')],
    });

    await expect(
      service.update('event-1', 'introduction-1', {
        action: 'assign',
        assignedToUserId: 'outsider',
      }),
    ).rejects.toMatchObject({ code: 'invalid_reference' });

    expect(store[0].row.status).toBe('REQUESTED');
    expect(store[0].history).toBe(0);
  });

  it('refuses to decline an introduced request', async () => {
    const { service } = harness({
      requests: [storedRequest('introduction-1', { status: 'INTRODUCED' })],
    });

    await expect(
      service.update('event-1', 'introduction-1', {
        action: 'decline',
        outcome: 'DECLINED',
      }),
    ).rejects.toMatchObject({ code: 'invalid_transition' });
  });

  it('refuses to assign a request that is already assigned', async () => {
    const { service } = harness({
      requests: [storedRequest('introduction-1', { status: 'ASSIGNED' })],
    });

    await expect(
      service.update('event-1', 'introduction-1', {
        action: 'assign',
        assignedToUserId: 'user-2',
      }),
    ).rejects.toMatchObject({ code: 'invalid_transition' });
  });

  it('reports a request from another event or tenant as not found', async () => {
    const { service } = harness();

    await expect(
      service.update('event-1', 'foreign-request', {
        action: 'decline',
        outcome: 'NO_MATCH',
      }),
    ).rejects.toMatchObject({ code: 'not_found' });

    await expect(service.detail('event-1', 'foreign-request')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('reports a profile from another event or tenant as not found', async () => {
    const { service } = harness({ eligibleProfiles: [] });

    await expect(
      service.create('event-1', {
        requestingProfileId: 'foreign-profile',
        reason: 'A reason',
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('refuses a write when the introductions module is disabled', async () => {
    const { service } = harness({ moduleEnabled: false });

    await expect(
      service.create('event-1', {
        requestingProfileId: 'profile-a',
        reason: 'A reason',
      }),
    ).rejects.toMatchObject({ code: 'module_not_enabled' });
  });
});
