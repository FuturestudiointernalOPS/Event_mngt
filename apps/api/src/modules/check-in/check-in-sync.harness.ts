import type { SyncScan } from '@event-platform/shared';
import type {
  AuditEntryInput,
  AuditService,
} from '../../common/audit/audit.service';
import type {
  TenantPrismaClient,
  TenantTransactionService,
} from '../../database/tenant-transaction.service';
import { EventStatus } from '../../database/prisma-client';
import type {
  BadgeVerification,
  BadgeVerificationService,
} from '../badges/badge-verification.service';
import type { ModuleRegistryService } from '../module-registry/module-registry.service';
import { CheckInSyncService } from './check-in-sync.service';
import type {
  CheckInRegistration,
  CheckInWithParticipant,
  CheckInsRepository,
  CreateCheckInData,
} from './check-ins.repository';

/** Shared fixtures for the offline sync spec. Not collected as a test file. */

const TX = {} as TenantPrismaClient;
const TENANT = {
  organizationId: 'org-1',
  userId: 'user-1',
  membershipId: 'member-1',
  permissions: [],
};

function registration(id: string, name: string): CheckInRegistration {
  return {
    id,
    eventId: 'event-1',
    reference: `IV26-${id}`,
    person: { firstName: name, lastName: 'Guest' },
    category: { name: 'Exhibitor' },
  };
}

function attendance(
  data: CreateCheckInData,
  id: string,
): CheckInWithParticipant {
  const person = data.registrationId === 'registration-1' ? 'Amina' : 'Koffi';

  return {
    id,
    organizationId: data.organizationId,
    eventId: data.eventId,
    registrationId: data.registrationId,
    source: data.source,
    scanId: data.scanId,
    scannedAt: data.scannedAt,
    receivedAt: data.receivedAt,
    checkedInByUserId: data.checkedInByUserId,
    deviceId: data.deviceId,
    createdAt: data.receivedAt,
    registration: {
      reference: `IV26-${data.registrationId}`,
      person: { firstName: person, lastName: 'Guest' },
      category: { name: 'Exhibitor' },
    },
  };
}

export function scan(
  scanId: string,
  badgeToken: string,
  scannedAt: string,
): SyncScan {
  return { scanId, badgeToken, scannedAt };
}

/** A row recorded online before the device connected, for replay tests. */
export function onlineAttendance(): CheckInWithParticipant {
  return attendance(
    {
      organizationId: 'org-1',
      eventId: 'event-1',
      registrationId: 'registration-1',
      source: 'ONLINE',
      scanId: null,
      scannedAt: new Date('2026-11-10T08:00:00.000Z'),
      receivedAt: new Date('2026-11-10T08:00:02.000Z'),
      checkedInByUserId: 'user-1',
      deviceId: null,
    },
    'check-in-online',
  );
}

export function harness() {
  const state = {
    event: { id: 'event-1', status: EventStatus.PUBLISHED },
    settings: { allowOffline: true, maxClockSkewMinutes: 5 },
    tokens: new Map<string, BadgeVerification | null>([
      [
        'token-1',
        { badgeId: 'badge-1', registrationId: 'registration-1', status: 'ISSUED' },
      ],
      [
        'token-2',
        { badgeId: 'badge-2', registrationId: 'registration-2', status: 'ISSUED' },
      ],
      [
        'revoked',
        { badgeId: 'badge-3', registrationId: 'registration-1', status: 'REVOKED' },
      ],
    ]),
    registrations: new Map<string, CheckInRegistration>([
      ['registration-1', registration('registration-1', 'Amina')],
      ['registration-2', registration('registration-2', 'Koffi')],
    ]),
    byScanId: new Map<string, CheckInWithParticipant>(),
    byRegistration: new Map<string, CheckInWithParticipant>(),
    created: [] as CreateCheckInData[],
    audits: [] as AuditEntryInput[],
    modules: [] as string[],
  };

  const repository = {
    findEventStatus: async () => state.event,
    findRegistration: async (
      _tx: unknown,
      _organizationId: string,
      _eventId: string,
      registrationId: string,
    ) => state.registrations.get(registrationId) ?? null,
    findByScanId: async (
      _tx: unknown,
      _organizationId: string,
      _eventId: string,
      scanId: string,
    ) => state.byScanId.get(scanId) ?? null,
    findByRegistration: async (
      _tx: unknown,
      _organizationId: string,
      _eventId: string,
      registrationId: string,
    ) => state.byRegistration.get(registrationId) ?? null,
    createOrReturnExisting: async (_tx: unknown, data: CreateCheckInData) => {
      const existing =
        (data.scanId ? state.byScanId.get(data.scanId) : undefined) ??
        state.byRegistration.get(data.registrationId);

      if (existing) {
        return { row: existing, created: false };
      }

      state.created.push(data);
      const row = attendance(data, `check-in-${state.created.length}`);
      state.byRegistration.set(data.registrationId, row);
      if (data.scanId) {
        state.byScanId.set(data.scanId, row);
      }

      return { row, created: true };
    },
  } as unknown as CheckInsRepository;

  const badges = {
    verifyForEventInTransaction: async (
      _tx: unknown,
      _organizationId: string,
      _eventId: string,
      token: string,
    ) => state.tokens.get(token) ?? null,
  } as unknown as BadgeVerificationService;

  const modules = {
    requireEnabled: async (
      _tx: unknown,
      _organizationId: string,
      _eventId: string,
      moduleKey: string,
    ) => {
      state.modules.push(moduleKey);
    },
    requireEnabledSettings: async () => state.settings,
  } as unknown as ModuleRegistryService;

  const audit = {
    record: async (entry: AuditEntryInput) => {
      state.audits.push(entry);
    },
  } as unknown as AuditService;

  const tenantTransaction = {
    withTenant: async (
      callback: (tx: TenantPrismaClient, tenant: typeof TENANT) => unknown,
    ) => callback(TX, TENANT),
  } as unknown as TenantTransactionService;

  return {
    service: new CheckInSyncService(
      tenantTransaction,
      repository,
      modules,
      badges,
      audit,
    ),
    state,
  };
}
