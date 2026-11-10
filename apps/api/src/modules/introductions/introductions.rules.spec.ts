import { describe, expect, it } from 'vitest';
import { IntroductionStatus } from '../../database/prisma-client';
import {
  assertIntroductionTransition,
  assertOutcomeForStatus,
  assertReasonRequired,
  autoAssignEnabled,
  initialAssignment,
  reasonRequired,
} from './introductions.rules';

describe('introduction state machine', () => {
  it('assigns a requested introduction', () => {
    expect(
      assertIntroductionTransition(IntroductionStatus.REQUESTED, 'assign'),
    ).toBe(IntroductionStatus.ASSIGNED);
  });

  it('declines from requested or assigned', () => {
    expect(
      assertIntroductionTransition(IntroductionStatus.REQUESTED, 'decline'),
    ).toBe(IntroductionStatus.DECLINED);
    expect(
      assertIntroductionTransition(IntroductionStatus.ASSIGNED, 'decline'),
    ).toBe(IntroductionStatus.DECLINED);
  });

  it('introduces only an assigned request', () => {
    expect(
      assertIntroductionTransition(IntroductionStatus.ASSIGNED, 'introduce'),
    ).toBe(IntroductionStatus.INTRODUCED);

    expect(() =>
      assertIntroductionTransition(IntroductionStatus.REQUESTED, 'introduce'),
    ).toThrowError(expect.objectContaining({ code: 'invalid_transition' }));
  });

  it('keeps introduced and declined terminal', () => {
    for (const status of [
      IntroductionStatus.INTRODUCED,
      IntroductionStatus.DECLINED,
    ]) {
      for (const action of ['assign', 'decline', 'introduce'] as const) {
        expect(() => assertIntroductionTransition(status, action)).toThrowError(
          expect.objectContaining({ code: 'invalid_transition' }),
        );
      }
    }
  });

  it('refuses a second assignment', () => {
    expect(() =>
      assertIntroductionTransition(IntroductionStatus.ASSIGNED, 'assign'),
    ).toThrowError(expect.objectContaining({ code: 'invalid_transition' }));
  });
});

describe('introduction settings and inputs', () => {
  it('requires a reason only when the setting is on', () => {
    expect(() => assertReasonRequired(true, null)).toThrowError(
      expect.objectContaining({ code: 'reason_required' }),
    );
    expect(() => assertReasonRequired(true, '   ')).toThrowError(
      expect.objectContaining({ code: 'reason_required' }),
    );
    expect(() => assertReasonRequired(true, 'Looking for a partner')).not.toThrow();
    expect(() => assertReasonRequired(false, null)).not.toThrow();
  });

  it('auto-assigns a request to its creator when enabled', () => {
    expect(initialAssignment(true, 'user-1')).toEqual({
      status: IntroductionStatus.ASSIGNED,
      assignedToUserId: 'user-1',
    });
  });

  it('leaves the request in the queue without autoAssign or an actor', () => {
    expect(initialAssignment(false, 'user-1')).toEqual({
      status: IntroductionStatus.REQUESTED,
      assignedToUserId: null,
    });
    expect(initialAssignment(true, null)).toEqual({
      status: IntroductionStatus.REQUESTED,
      assignedToUserId: null,
    });
  });

  it('records only the outcome the final state allows', () => {
    expect(() =>
      assertOutcomeForStatus(IntroductionStatus.INTRODUCED, 'CONNECTED'),
    ).not.toThrow();
    expect(() =>
      assertOutcomeForStatus(IntroductionStatus.INTRODUCED, 'FOLLOW_UP'),
    ).not.toThrow();
    expect(() =>
      assertOutcomeForStatus(IntroductionStatus.DECLINED, 'NO_MATCH'),
    ).not.toThrow();
    expect(() =>
      assertOutcomeForStatus(IntroductionStatus.DECLINED, 'DECLINED'),
    ).not.toThrow();
    expect(() =>
      assertOutcomeForStatus(IntroductionStatus.INTRODUCED, 'NO_MATCH'),
    ).toThrowError(expect.objectContaining({ code: 'invalid_outcome' }));
  });

  it('reads the module settings', () => {
    expect(reasonRequired({ requireReason: true })).toBe(true);
    expect(reasonRequired({})).toBe(false);
    expect(autoAssignEnabled({ autoAssign: true })).toBe(true);
    expect(autoAssignEnabled({})).toBe(false);
  });
});
