import type { AuditEntryInput, AuditService } from '../../common/audit/audit.service';
import type { AppException } from '../../common/app-exception';
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
import type {
  CheckInRegistration,
  CheckInWithParticipant,
  CheckInsRepository,
  CreateCheckInData,
} from './check-ins.repository';
import { CheckInsService } from './check-ins.service';

/** Shared fixtures for the check-in service specs. Not collected as a test file. */

export const TX = {} as TenantPrismaClient;
export const TENANT = {
  organizationId: 'org-1',
  userId: 'user-1',
  membershipId: 'member-1',
  permissions: [],
};

export const EVENT: { id: string; status: EventStatus } = {
  id: 'event-1',
  status: EventStatus.PUBLISHED,
};

export const REGISTRATION: CheckInRegistration = {
  id: 'registration-1',
  eventId: 'event-1',
  reference: 'IV26-0001',
  person: { firstName: 'Amina', lastName: 'Dossou' },
  category: { name: 'Exhibitor' },
};

export const BADGE: BadgeVerification = {
  badgeId: 'badge-1',
  registrationId: 'registration-1',
  status: 'ISSUED',
};

export const INPUT = {
  badgeToken: 'raw-secret-token',
  scannedAt: '2026-11-10T09:00:00.000Z',
};

export function attendance(
  overrides: Partial<CheckInWithParticipant> = {},
): CheckInWithParticipant {
  return {
    id: 'check-in-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    registrationId: 'registration-1',
    source: 'ONLINE',
    scanId: null,
    scannedAt: new Date('2026-11-10T08:00:00.000Z'),
    receivedAt: new Date('2026-11-10T08:00:02.000Z'),
    checkedInByUserId: 'user-1',
    deviceId: null,
    createdAt: new Date('2026-11-10T08:00:02.000Z'),
    registration: {
      reference: 'IV26-0001',
      person: { firstName: 'Amina', lastName: 'Dossou' },
      category: { name: 'Exhibitor' },
    },
    ...overrides,
  };
}

export interface HarnessOptions {
  event?: typeof EVENT | null;
  badge?: BadgeVerification | null;
  registration?: CheckInRegistration | null;
  existing?: CheckInWithParticipant | null;
  existingForScan?: CheckInWithParticipant | null;
  raced?: CheckInWithParticipant | null;
  moduleError?: AppException | null;
  settings?: Record<string, unknown>;
  rows?: CheckInWithParticipant[];
  total?: number;
  byCategory?: Array<{ key: string; name: string; checkedIn: number }>;
}

export function harness(options: HarnessOptions = {}) {
  const event = options.event === undefined ? EVENT : options.event;
  const badge = options.badge === undefined ? BADGE : options.badge;
  const registration =
    options.registration === undefined ? REGISTRATION : options.registration;
  const rows = options.rows ?? [];
  const total = options.total ?? rows.length;

  const created: CreateCheckInData[] = [];
  const listCalls: Array<{ skip: number; take: number }> = [];
  const audits: AuditEntryInput[] = [];
  const moduleCalls: string[] = [];

  const repository = {
    findEventStatus: async () => event,
    findRegistration: async () => registration,
    findByRegistration: async () => options.existing ?? null,
    findByScanId: async () => options.existingForScan ?? null,
    createOrReturnExisting: async (_tx: unknown, data: CreateCheckInData) => {
      created.push(data);

      if (options.raced) {
        return { row: options.raced, created: false };
      }

      return {
        row: attendance({
          ...data,
          registration: {
            reference: registration?.reference ?? 'IV26-0001',
            person: registration?.person ?? {
              firstName: 'Amina',
              lastName: 'Dossou',
            },
            category: registration?.category ?? null,
          },
        }),
        created: true,
      };
    },
    list: async (
      _tx: unknown,
      _organizationId: string,
      _eventId: string,
      skip: number,
      take: number,
    ) => {
      listCalls.push({ skip, take });
      return [rows.slice(skip, skip + take), total] as [
        CheckInWithParticipant[],
        number,
      ];
    },
    count: async () => total,
    countByCategory: async () => options.byCategory ?? [],
  } as unknown as CheckInsRepository;

  const badges = {
    verifyForEventInTransaction: async () => badge,
  } as unknown as BadgeVerificationService;

  const modules = {
    requireEnabled: async (
      _tx: unknown,
      _organizationId: string,
      _eventId: string,
      moduleKey: string,
    ) => {
      moduleCalls.push(moduleKey);

      if (options.moduleError) {
        throw options.moduleError;
      }
    },
    requireEnabledSettings: async () =>
      options.settings ?? { allowOffline: true, duplicateWindowMinutes: 5 },
  } as unknown as ModuleRegistryService;

  const audit = {
    record: async (entry: AuditEntryInput) => {
      audits.push(entry);
    },
  } as unknown as AuditService;

  const tenantTransaction = {
    withTenant: async (
      callback: (tx: TenantPrismaClient, tenant: typeof TENANT) => unknown,
    ) => callback(TX, TENANT),
  } as unknown as TenantTransactionService;

  return {
    service: new CheckInsService(
      tenantTransaction,
      repository,
      modules,
      badges,
      audit,
    ),
    created,
    listCalls,
    audits,
    moduleCalls,
  };
}
