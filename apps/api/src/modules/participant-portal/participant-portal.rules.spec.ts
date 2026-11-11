import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import { assertCanWithdraw } from './participant-portal.rules';

function code(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof AppException ? error.code : 'other';
  }
}

describe('assertCanWithdraw', () => {
  it('lets an approved, not-yet-attended registrant withdraw', () => {
    expect(code(() => assertCanWithdraw({ status: 'APPROVED', checkedIn: false }))).toBeNull();
  });

  it('refuses after check-in and for registrations that are not active', () => {
    expect(code(() => assertCanWithdraw({ status: 'APPROVED', checkedIn: true }))).toBe('already_checked_in');
    expect(code(() => assertCanWithdraw({ status: 'CANCELLED', checkedIn: false }))).toBe('invalid_status');
    expect(code(() => assertCanWithdraw({ status: 'PENDING', checkedIn: false }))).toBe('invalid_status');
  });
});
