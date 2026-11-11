import { describe, expect, it } from 'vitest';
import { toMeeting } from './meetings.mapper';
import type { MeetingRow } from './meetings.repository';

function row(overrides: Partial<MeetingRow> = {}): MeetingRow {
  return {
    id: 'meeting-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    proposerProfileId: 'profile-a',
    recipientProfileId: 'profile-b',
    status: 'PROPOSED',
    requiresStaffConfirmation: true,
    proposedAt: new Date('2026-03-01T09:30:00.000Z'),
    durationMinutes: 30,
    note: null,
    decidedAt: null,
    decidedByUserId: null,
    outcome: null,
    outcomeNotes: null,
    createdAt: new Date('2026-03-01T09:30:00.000Z'),
    updatedAt: new Date('2026-03-01T09:30:00.000Z'),
    proposer: {
      id: 'profile-a',
      registration: { person: { firstName: 'Amina', lastName: 'Dossou' } },
    },
    recipient: {
      id: 'profile-b',
      registration: { person: { firstName: 'Koffi', lastName: 'Mensah' } },
    },
    ...overrides,
  };
}

describe('toMeeting', () => {
  it('maps the row and both display names', () => {
    const meeting = toMeeting(row());

    expect(meeting.proposer).toEqual({
      id: 'profile-a',
      displayName: 'Amina Dossou',
    });
    expect(meeting.recipient.displayName).toBe('Koffi Mensah');
    expect(meeting.proposedAt).toBe('2026-03-01T09:30:00.000Z');
    expect(meeting.decidedAt).toBeNull();
    expect(meeting.outcome).toBeNull();
  });

  it('maps a completed meeting with its outcome', () => {
    const meeting = toMeeting(
      row({
        status: 'COMPLETED',
        decidedAt: new Date('2026-03-02T11:00:00.000Z'),
        outcome: 'FOLLOW_UP',
        outcomeNotes: 'Send the deck',
      }),
    );

    expect(meeting.status).toBe('COMPLETED');
    expect(meeting.decidedAt).toBe('2026-03-02T11:00:00.000Z');
    expect(meeting.outcome).toBe('FOLLOW_UP');
    expect(meeting.outcomeNotes).toBe('Send the deck');
  });
});
