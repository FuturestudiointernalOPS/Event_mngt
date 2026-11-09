import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import {
  assertCanComplete,
  assertCanConfirmMeeting,
  assertCanPropose,
  assertCanSelfCancel,
  assertCanRequestIntroduction,
  assertConfirmed,
  assertIntroductionTransition,
  resolveMeetingResponse,
} from './participants.rules';

function code(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof AppException ? error.code : 'other';
  }
}

describe('assertConfirmed', () => {
  it('only lets confirmed registrations use participant features', () => {
    expect(code(() => assertConfirmed('CONFIRMED'))).toBeNull();
    expect(code(() => assertConfirmed('PENDING'))).toBe('registration_not_confirmed');
  });
});

describe('assertCanPropose', () => {
  it('refuses a meeting with yourself and enforces the limit', () => {
    expect(code(() => assertCanPropose({ proposerId: 'a', inviteeId: 'a', proposalsSoFar: 0, max: 5 }))).toBe('invalid_invitee');
    expect(code(() => assertCanPropose({ proposerId: 'a', inviteeId: 'b', proposalsSoFar: 5, max: 5 }))).toBe('proposal_limit');
    expect(code(() => assertCanPropose({ proposerId: 'a', inviteeId: 'b', proposalsSoFar: 4, max: 5 }))).toBeNull();
  });
});

describe('resolveMeetingResponse', () => {
  it('lets the invitee accept or decline a pending proposal', () => {
    expect(resolveMeetingResponse('ACCEPT', 'PROPOSED', 'invitee')).toBe('ACCEPTED');
    expect(resolveMeetingResponse('DECLINE', 'PROPOSED', 'invitee')).toBe('DECLINED');
  });

  it('does not let the proposer answer their own proposal', () => {
    expect(code(() => resolveMeetingResponse('ACCEPT', 'PROPOSED', 'proposer'))).toBe('not_invitee');
  });

  it('does not let an answered proposal be answered again', () => {
    expect(code(() => resolveMeetingResponse('ACCEPT', 'ACCEPTED', 'invitee'))).toBe('invalid_status_transition');
  });

  it('lets either side cancel a live meeting but not a finished one', () => {
    expect(resolveMeetingResponse('CANCEL', 'ACCEPTED', 'proposer')).toBe('CANCELLED');
    expect(code(() => resolveMeetingResponse('CANCEL', 'DECLINED', 'invitee'))).toBe('invalid_status_transition');
  });
});

describe('assertIntroductionTransition', () => {
  it('follows the queue order', () => {
    expect(code(() => assertIntroductionTransition('SUBMITTED', 'IN_REVIEW', undefined))).toBeNull();
    expect(code(() => assertIntroductionTransition('APPROVED', 'INTRODUCED', 'Met on stage'))).toBeNull();
  });

  it('refuses skipping steps and reopening a closed request', () => {
    expect(code(() => assertIntroductionTransition('SUBMITTED', 'INTRODUCED', 'x'))).toBe('invalid_status_transition');
    expect(code(() => assertIntroductionTransition('CLOSED', 'IN_REVIEW', undefined))).toBe('invalid_status_transition');
  });

  it('requires an outcome to record an introduction', () => {
    expect(code(() => assertIntroductionTransition('APPROVED', 'INTRODUCED', undefined))).toBe('outcome_required');
  });
});

describe('assertCanRequestIntroduction', () => {
  const ok = { requesterId: 'a', ownerId: 'b', innovationApproved: true, openRequestExists: false };

  it('allows a normal request', () => {
    expect(code(() => assertCanRequestIntroduction(ok))).toBeNull();
  });

  it('hides unapproved innovations, blocks self-requests and duplicates', () => {
    expect(code(() => assertCanRequestIntroduction({ ...ok, innovationApproved: false }))).toBe('not_found');
    expect(code(() => assertCanRequestIntroduction({ ...ok, ownerId: 'a' }))).toBe('own_innovation');
    expect(code(() => assertCanRequestIntroduction({ ...ok, openRequestExists: true }))).toBe('request_exists');
  });
});

describe('assertCanSelfCancel', () => {
  it('lets an active, not-yet-checked-in participant withdraw', () => {
    expect(code(() => assertCanSelfCancel('PENDING', 0))).toBeNull();
    expect(code(() => assertCanSelfCancel('CONFIRMED', 0))).toBeNull();
  });

  it('refuses after check-in or when already inactive', () => {
    expect(code(() => assertCanSelfCancel('CONFIRMED', 1))).toBe('already_checked_in');
    expect(code(() => assertCanSelfCancel('CANCELLED', 0))).toBe('invalid_status_transition');
  });
});

describe('staff confirmation of meetings', () => {
  it('confirms an accepted meeting only when the module requires it', () => {
    expect(code(() => assertCanConfirmMeeting('ACCEPTED', true))).toBeNull();
    expect(code(() => assertCanConfirmMeeting('ACCEPTED', false))).toBe('confirmation_not_required');
    expect(code(() => assertCanConfirmMeeting('PROPOSED', true))).toBe('invalid_status_transition');
  });

  it('completes from the settled state for the configured mode', () => {
    expect(code(() => assertCanComplete('CONFIRMED', true))).toBeNull();
    expect(code(() => assertCanComplete('ACCEPTED', true))).toBe('invalid_status_transition');
    expect(code(() => assertCanComplete('ACCEPTED', false))).toBeNull();
    expect(code(() => assertCanComplete('CONFIRMED', false))).toBe('invalid_status_transition');
  });

  it('lets a confirmed meeting still be cancelled', () => {
    expect(resolveMeetingResponse('CANCEL', 'CONFIRMED', 'proposer')).toBe('CANCELLED');
  });
});
