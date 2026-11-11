import type {
  Meeting as MeetingContract,
  MeetingProfile,
} from '@event-platform/shared';
import type { MeetingRow, MeetingProfileRow } from './meetings.repository';

/** Row → contract. The display name is the only personal field an operator needs. */

function displayName(profile: MeetingProfileRow): string {
  return `${profile.registration.person.firstName} ${profile.registration.person.lastName}`.trim();
}

function toProfile(profile: MeetingProfileRow): MeetingProfile {
  return { id: profile.id, displayName: displayName(profile) };
}

export function toMeeting(row: MeetingRow): MeetingContract {
  return {
    id: row.id,
    status: row.status,
    proposedAt: row.proposedAt.toISOString(),
    durationMinutes: row.durationMinutes,
    note: row.note,
    requiresStaffConfirmation: row.requiresStaffConfirmation,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    outcome: row.outcome,
    outcomeNotes: row.outcomeNotes,
    proposer: toProfile(row.proposer),
    recipient: toProfile(row.recipient),
  };
}
