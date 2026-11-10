import { describe, expect, it } from 'vitest';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { EventStatus, Prisma } from '../../database/prisma-client';
import {
  CHECK_IN_ORDER,
  CheckInsRepository,
  type CheckInWithParticipant,
  type CreateCheckInData,
} from './check-ins.repository';

const EVENT = { id: 'event-1', status: EventStatus.PUBLISHED };

const REGISTRATION = {
  id: 'registration-1',
  eventId: 'event-1',
  reference: 'IV26-0001',
  person: { firstName: 'Amina', lastName: 'Dossou' },
  category: { name: 'Exhibitor' },
};

function attendance(
  overrides: Partial<CheckInWithParticipant> = {},
): CheckInWithParticipant {
  return {
    id: 'check-in-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    registrationId: 'registration-1',
    source: 'ONLINE',
    scanId: null,
    scannedAt: new Date('2026-11-10T09:00:00.000Z'),
    receivedAt: new Date('2026-11-10T09:00:02.000Z'),
    checkedInByUserId: 'user-1',
    deviceId: null,
    createdAt: new Date('2026-11-10T09:00:02.000Z'),
    registration: {
      reference: 'IV26-0001',
      person: { firstName: 'Amina', lastName: 'Dossou' },
      category: { name: 'Exhibitor' },
    },
    ...overrides,
  };
}

interface Call {
  model: string;
  method: string;
  args: Record<string, unknown>;
}

function fakeTx() {
  const calls: Call[] = [];
  const respond =
    (model: string, method: string, result: unknown) =>
    async (args: Record<string, unknown>) => {
      calls.push({ model, method, args });
      return result;
    };

  const tx = {
    event: { findFirst: respond('event', 'findFirst', EVENT) },
    registration: { findFirst: respond('registration', 'findFirst', REGISTRATION) },
    checkIn: {
      findFirst: respond('checkIn', 'findFirst', attendance()),
      findMany: respond('checkIn', 'findMany', [attendance()]),
      count: respond('checkIn', 'count', 1),
      create: respond('checkIn', 'create', attendance()),
    },
  } as unknown as TenantPrismaClient;

  return { tx, calls };
}

/** A write that fails, followed by the read that finds the winning row. */
function racingTx(error: unknown): TenantPrismaClient {
  return {
    checkIn: {
      create: async () => {
        throw error;
      },
      findFirst: async () => attendance(),
    },
  } as unknown as TenantPrismaClient;
}

const repository = new CheckInsRepository();

const CREATE_DATA: CreateCheckInData = {
  organizationId: 'org-1',
  eventId: 'event-1',
  registrationId: 'registration-1',
  source: 'ONLINE',
  scanId: null,
  scannedAt: new Date('2026-11-10T09:00:00.000Z'),
  receivedAt: new Date('2026-11-10T09:00:02.000Z'),
  checkedInByUserId: 'user-1',
  deviceId: null,
};

function whereOf(call: Call): Record<string, unknown> {
  return call.args.where as Record<string, unknown>;
}

describe('attendance queries carry the tenant and event predicates', () => {
  it('scopes the event lookup', async () => {
    const { tx, calls } = fakeTx();

    await repository.findEventStatus(tx, 'org-1', 'event-1');

    expect(whereOf(calls[0])).toEqual({ id: 'event-1', organizationId: 'org-1' });
  });

  it('scopes the registration lookup by organisation and event', async () => {
    const { tx, calls } = fakeTx();

    await repository.findRegistration(tx, 'org-1', 'event-1', 'registration-1');

    expect(whereOf(calls[0])).toEqual({
      id: 'registration-1',
      organizationId: 'org-1',
      eventId: 'event-1',
    });
  });

  it('scopes a lookup by registration', async () => {
    const { tx, calls } = fakeTx();

    await repository.findByRegistration(tx, 'org-1', 'event-1', 'registration-1');

    expect(whereOf(calls[0])).toEqual({
      organizationId: 'org-1',
      eventId: 'event-1',
      registrationId: 'registration-1',
    });
  });

  it('scopes a replay lookup by scan id', async () => {
    const { tx, calls } = fakeTx();

    await repository.findByScanId(tx, 'org-1', 'event-1', 'scan-1');

    expect(whereOf(calls[0])).toEqual({
      organizationId: 'org-1',
      eventId: 'event-1',
      scanId: 'scan-1',
    });
  });

  it('scopes the list and its count, newest first', async () => {
    const { tx, calls } = fakeTx();

    await repository.list(tx, 'org-1', 'event-1', 20, 10);

    const [findMany, count] = calls;

    expect(whereOf(findMany)).toEqual({
      organizationId: 'org-1',
      eventId: 'event-1',
    });
    expect(findMany.args.orderBy).toEqual(CHECK_IN_ORDER);
    expect(CHECK_IN_ORDER[0]).toEqual({ scannedAt: 'desc' });
    expect(findMany.args.skip).toBe(20);
    expect(findMany.args.take).toBe(10);
    expect(whereOf(count)).toEqual({
      organizationId: 'org-1',
      eventId: 'event-1',
    });
  });

  it('scopes the summary count', async () => {
    const { tx, calls } = fakeTx();

    await repository.count(tx, 'org-1', 'event-1');

    expect(whereOf(calls[0])).toEqual({
      organizationId: 'org-1',
      eventId: 'event-1',
    });
  });

  it('writes the organisation and event, and stores no scanned value', async () => {
    const { tx, calls } = fakeTx();

    await repository.create(tx, CREATE_DATA);

    const data = calls[0].args.data as Record<string, unknown>;

    expect(data).toMatchObject({
      organizationId: 'org-1',
      eventId: 'event-1',
      registrationId: 'registration-1',
    });
    expect(Object.keys(data)).not.toContain('badgeToken');
    expect(Object.keys(data)).not.toContain('token');
    expect(Object.keys(data)).not.toContain('tokenHash');
  });

  it('answers a concurrent insert with the row that won the race', async () => {
    const outcome = await repository.createOrReturnExisting(
      racingTx(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.1',
        }),
      ),
      CREATE_DATA,
    );

    expect(outcome.created).toBe(false);
    expect(outcome.row.id).toBe('check-in-1');
  });

  it('does not hide an unrelated write failure', async () => {
    await expect(
      repository.createOrReturnExisting(racingTx(new Error('database down')), CREATE_DATA),
    ).rejects.toThrow('database down');
  });
});
