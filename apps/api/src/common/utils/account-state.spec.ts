import { describe, expect, it } from 'vitest';
import { accountOnboardingProblem } from './account-state';

describe('account onboarding state', () => {
  it('accepts an active, verified account', () => {
    expect(
      accountOnboardingProblem({
        status: 'ACTIVE',
        emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toBeNull();
  });

  it('marks a suspended account', () => {
    expect(
      accountOnboardingProblem({
        status: 'SUSPENDED',
        emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toBe('suspended');
  });

  it('marks an unverified or pending account', () => {
    expect(
      accountOnboardingProblem({
        status: 'ACTIVE',
        emailVerifiedAt: null,
      }),
    ).toBe('unverified');

    expect(
      accountOnboardingProblem({
        status: 'PENDING_VERIFICATION',
        emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toBe('unverified');
  });
});
