import { describe, expect, it } from 'vitest';
import type { CheckInWithParticipant } from './check-ins.repository';
import { toCheckIn } from './check-ins.mapper';

function row(
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

describe('check-in mapper', () => {
  it('returns the attendance record and the participant needed at the door', () => {
    const contract = toCheckIn(row(), false);

    expect(contract).toEqual({
      id: 'check-in-1',
      registrationId: 'registration-1',
      reference: 'IV26-0001',
      participant: { displayName: 'Amina Dossou', category: 'Exhibitor' },
      source: 'ONLINE',
      scannedAt: '2026-11-10T09:00:00.000Z',
      receivedAt: '2026-11-10T09:00:02.000Z',
      duplicate: false,
    });
  });

  it('keeps the duplicate flag it is given', () => {
    expect(toCheckIn(row(), true).duplicate).toBe(true);
  });

  it('reports a missing category as null', () => {
    const contract = toCheckIn(
      row({
        registration: {
          reference: 'IV26-0002',
          person: { firstName: 'Koffi', lastName: 'Mensah' },
          category: null,
        },
      }),
      false,
    );

    expect(contract.participant).toEqual({
      displayName: 'Koffi Mensah',
      category: null,
    });
  });

  it('exposes only the staff projection', () => {
    expect(Object.keys(toCheckIn(row(), false)).sort()).toEqual([
      'duplicate',
      'id',
      'participant',
      'receivedAt',
      'reference',
      'registrationId',
      'scannedAt',
      'source',
    ]);
    expect(Object.keys(toCheckIn(row(), false).participant).sort()).toEqual([
      'category',
      'displayName',
    ]);
  });
});
