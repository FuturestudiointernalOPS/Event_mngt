import { describe, expect, it } from 'vitest';
import type {
  TenantPrismaClient,
  TenantTransactionService,
} from '../../database/tenant-transaction.service';
import { AppException } from '../../common/app-exception';
import type { ModuleRegistryService } from '../module-registry/module-registry.service';
import type {
  CreateMeetingData,
  MeetingProfileRow,
  MeetingRow,
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

interface Options {
  moduleEnabled?: boolean;
  settings?: Record<string, unknown>;
  eligibleProfiles?: string[];
  meetings?: MeetingRow[];
}

function harness(options: Options = {}) {
  const eligible = options.eligibleProfiles ?? ['profile-a', 'profile-b', 'profile-c'];
  const store: MeetingRow[] = [...(options.meetings ?? [])];
  let sequence = 0;

  const repository = {
    findEligibleProfiles: async (_tx: unknown, _o: string, _e: string, ids: string[]) =>
      ids.filter((id) => eligible.includes(id)).map(profile),
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
  } as unknown as MeetingsRepository;

  const modules = {
    requireEnabled: async () => {
      if (options.moduleEnabled === false) {
        throw AppException.unprocessable(
          'module_not_enabled',
          'The "meetings" module is not enabled for this event.',
        );
      }
    },
    requireEnabledSettings: async () =>
      options.settings ?? {
        requiresStaffConfirmation: true,
        maxProposalsPerParticipant: 10,
      },
  } as unknown as ModuleRegistryService;

  const tenantTransaction = {
    withTenant: async (
      callback: (tx: TenantPrismaClient, tenant: typeof TENANT) => unknown,
    ) => callback(TX, TENANT),
  } as unknown as TenantTransactionService;

  return {
    service: new MeetingsService(tenantTransaction, repository, modules),
    store,
  };
}

const PAIR = { proposerProfileId: 'profile-a', recipientProfileId: 'profile-b' };

describe('meeting proposal refusals', () => {
  it('refuses pairing a profile with itself', async () => {
    const { service } = harness();

    await expect(
      service.propose('event-1', {
        proposerProfileId: 'profile-a',
        recipientProfileId: 'profile-a',
      }),
    ).rejects.toMatchObject({ code: 'invalid_reference' });
  });

  it('reports a profile from another event or tenant as not found', async () => {
    const { service } = harness();

    await expect(
      service.propose('event-1', {
        proposerProfileId: 'profile-a',
        recipientProfileId: 'foreign-profile',
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('refuses a second active proposal for the same pair, either direction', async () => {
    const arrangements = [
      meeting({
        id: 'meeting-1',
        proposerProfileId: 'profile-b',
        recipientProfileId: 'profile-a',
      }),
      meeting({ id: 'meeting-2' }),
    ];

    for (const existing of arrangements) {
      const { service } = harness({ meetings: [existing] });

      await expect(service.propose('event-1', PAIR)).rejects.toMatchObject({
        code: 'duplicate_meeting',
      });
    }
  });

  it('allows a new proposal after the previous one finished', async () => {
    const { service } = harness({
      meetings: [meeting({ id: 'meeting-1', status: 'DECLINED' })],
    });

    const proposed = await service.propose('event-1', PAIR);

    expect(proposed.status).toBe('PROPOSED');
  });

  it('enforces maxProposalsPerParticipant on active proposals', async () => {
    const { service } = harness({
      settings: { requiresStaffConfirmation: false, maxProposalsPerParticipant: 1 },
      meetings: [meeting({ id: 'meeting-1', recipientProfileId: 'profile-c' })],
    });

    await expect(service.propose('event-1', PAIR)).rejects.toMatchObject({
      code: 'proposal_limit_reached',
    });
  });

  it('snapshots requiresStaffConfirmation from the module settings', async () => {
    const { service } = harness({
      settings: { requiresStaffConfirmation: false, maxProposalsPerParticipant: 10 },
    });

    const proposed = await service.propose('event-1', PAIR);

    expect(proposed.requiresStaffConfirmation).toBe(false);
  });

  it('refuses a write when the meetings module is disabled', async () => {
    const { service } = harness({ moduleEnabled: false });

    await expect(service.propose('event-1', PAIR)).rejects.toMatchObject({
      code: 'module_not_enabled',
    });
  });
});
