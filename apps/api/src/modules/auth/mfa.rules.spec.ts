import { describe, expect, it } from 'vitest';
import {
  MAX_FAILED_ATTEMPTS,
  afterFailure,
  hashRecoveryCode,
  isLocked,
  looksLikeRecoveryCode,
  newRecoveryCode,
} from './mfa.rules';

const now = new Date('2026-06-01T10:00:00Z');

describe('lockout', () => {
  it('counts failures and locks at the limit, then resets the counter', () => {
    let state = { failedAttempts: 0, lockedUntil: null as Date | null };
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i += 1) {
      state = afterFailure(state.failedAttempts, now);
      expect(state.lockedUntil).toBeNull();
    }
    state = afterFailure(state.failedAttempts, now);

    expect(state.lockedUntil).not.toBeNull();
    expect(state.failedAttempts).toBe(0);
    expect(isLocked(state.lockedUntil, now)).toBe(true);
    expect(isLocked(state.lockedUntil, new Date(now.getTime() + 6 * 60_000))).toBe(false);
  });

  it('is not locked without a lock date', () => {
    expect(isLocked(null, now)).toBe(false);
  });
});

describe('recovery codes', () => {
  it('generates distinct, well-formed codes', () => {
    const a = newRecoveryCode();
    expect(a).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
    expect(newRecoveryCode()).not.toBe(a);
    expect(looksLikeRecoveryCode(a)).toBe(true);
  });

  it('hashes regardless of case and dash, and never stores the code itself', () => {
    expect(hashRecoveryCode('abcde-fghij')).toBe(hashRecoveryCode('ABCDEFGHIJ'));
    expect(hashRecoveryCode('ABCDE-FGHIJ')).not.toContain('ABCDE');
  });

  it('does not mistake a 6-digit authenticator code for a recovery code', () => {
    expect(looksLikeRecoveryCode('123456')).toBe(false);
  });
});
