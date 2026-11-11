import { describe, expect, it } from 'vitest';
import { MeetingStatus } from '../../database/prisma-client';
import {
  assertDistinctProfiles,
  assertMeetingTransition,
  assertParticipantMayRespond,
  assertProposalLimit,
  maxProposalsPerParticipant,
  requiresStaffConfirmation,
  targetStatus,
} from './meetings.rules';

describe('meeting state machine', () => {
  it('accepts, declines or cancels a proposal', () => {
    expect(assertMeetingTransition(MeetingStatus.PROPOSED, 'accept')).toBe(
      MeetingStatus.ACCEPTED,
    );
    expect(assertMeetingTransition(MeetingStatus.PROPOSED, 'decline')).toBe(
      MeetingStatus.DECLINED,
    );
    expect(assertMeetingTransition(MeetingStatus.PROPOSED, 'cancel')).toBe(
      MeetingStatus.CANCELLED,
    );
  });

  it('completes or cancels an accepted meeting', () => {
    expect(assertMeetingTransition(MeetingStatus.ACCEPTED, 'complete')).toBe(
      MeetingStatus.COMPLETED,
    );
    expect(assertMeetingTransition(MeetingStatus.ACCEPTED, 'cancel')).toBe(
      MeetingStatus.CANCELLED,
    );
  });

  it('refuses to accept a meeting that is not proposed', () => {
    expect(() =>
      assertMeetingTransition(MeetingStatus.ACCEPTED, 'accept'),
    ).toThrowError(expect.objectContaining({ code: 'invalid_transition' }));

    expect(() =>
      assertMeetingTransition(MeetingStatus.DECLINED, 'accept'),
    ).toThrowError(expect.objectContaining({ code: 'invalid_transition' }));
  });

  it('refuses to bring a finished meeting back', () => {
    for (const status of [
      MeetingStatus.DECLINED,
      MeetingStatus.CANCELLED,
      MeetingStatus.COMPLETED,
    ]) {
      expect(() => assertMeetingTransition(status, 'cancel')).toThrowError(
        expect.objectContaining({ code: 'invalid_transition' }),
      );
    }
  });

  it('exposes the target of each action', () => {
    expect(targetStatus('decline')).toBe(MeetingStatus.DECLINED);
    expect(targetStatus('complete')).toBe(MeetingStatus.COMPLETED);
  });
});

describe('meeting proposal rules', () => {
  it('refuses a profile paired with itself', () => {
    expect(() => assertDistinctProfiles('profile-a', 'profile-a')).toThrowError(
      expect.objectContaining({ code: 'invalid_reference' }),
    );
    expect(() => assertDistinctProfiles('profile-a', 'profile-b')).not.toThrow();
  });

  it('allows proposals below the cap and refuses the one at the cap', () => {
    expect(() => assertProposalLimit(0, 1)).not.toThrow();
    expect(() => assertProposalLimit(1, 2)).not.toThrow();
    expect(() => assertProposalLimit(1, 1)).toThrowError(
      expect.objectContaining({ code: 'proposal_limit_reached' }),
    );
  });

  it('snapshots the staff-confirmation setting', () => {
    expect(requiresStaffConfirmation({ requiresStaffConfirmation: true })).toBe(
      true,
    );
    expect(requiresStaffConfirmation({ requiresStaffConfirmation: false })).toBe(
      false,
    );
    expect(requiresStaffConfirmation({})).toBe(false);
  });

  it('falls back to ten proposals when the setting is absent', () => {
    expect(maxProposalsPerParticipant({})).toBe(10);
    expect(maxProposalsPerParticipant({ maxProposalsPerParticipant: 5 })).toBe(5);
    expect(
      maxProposalsPerParticipant({ maxProposalsPerParticipant: 'many' }),
    ).toBe(10);
  });
});

describe('assertParticipantMayRespond', () => {
  const base = { isProposer: false, isRecipient: true, requiresStaffConfirmation: false } as const;
  const code = (fn: () => void): string | null => {
    try {
      fn();
      return null;
    } catch (error) {
      return (error as { code?: string }).code ?? 'other';
    }
  };

  it('lets the recipient accept or decline when staff do not decide', () => {
    expect(code(() => assertParticipantMayRespond({ ...base, action: 'accept' }))).toBeNull();
    expect(code(() => assertParticipantMayRespond({ ...base, action: 'decline' }))).toBeNull();
  });

  it('does not let the proposer answer their own proposal', () => {
    expect(code(() => assertParticipantMayRespond({ ...base, isProposer: true, isRecipient: false, action: 'accept' }))).toBe('not_recipient');
  });

  it('reserves the answer for staff when the event asks for staff confirmation', () => {
    expect(code(() => assertParticipantMayRespond({ ...base, requiresStaffConfirmation: true, action: 'accept' }))).toBe('staff_decision_required');
  });

  it('lets either side cancel regardless of the staff setting', () => {
    expect(code(() => assertParticipantMayRespond({ ...base, isProposer: true, isRecipient: false, requiresStaffConfirmation: true, action: 'cancel' }))).toBeNull();
  });
});
