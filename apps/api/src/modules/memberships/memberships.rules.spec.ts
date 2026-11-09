import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import {
  assertAdministratorRemains,
  assertInvitationUsable,
  isAdministrativeRole,
  type InvitationCandidate,
} from './memberships.rules';

function invitation(overrides: Partial<InvitationCandidate> = {}): InvitationCandidate {
  return {
    email: 'invitee@example.test',
    consumedAt: null,
    expiresAt: new Date(Date.now() + 3_600_000),
    ...overrides,
  };
}

function capture(fn: () => void): AppException {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected the call to throw');
}

describe('assertInvitationUsable', () => {
  it('accepts a fresh invitation for the invited address', () => {
    expect(() => assertInvitationUsable(invitation(), 'invitee@example.test')).not.toThrow();
  });

  it('matches the address case-insensitively', () => {
    expect(() =>
      assertInvitationUsable(invitation(), 'INVITEE@Example.Test'),
    ).not.toThrow();
  });

  it('rejects a consumed invitation', () => {
    expect(
      capture(() => assertInvitationUsable(invitation({ consumedAt: new Date() }), 'invitee@example.test')).code,
    ).toBe('invalid_invitation');
  });

  it('rejects an expired invitation', () => {
    expect(
      capture(() =>
        assertInvitationUsable(
          invitation({ expiresAt: new Date(Date.now() - 1) }),
          'invitee@example.test',
        ),
      ).code,
    ).toBe('invalid_invitation');
  });

  it('rejects a different address with the same message', () => {
    const error = capture(() => assertInvitationUsable(invitation(), 'someone@else.test'));

    expect(error.code).toBe('invalid_invitation');
    expect(error.message).not.toContain('invitee');
  });
});

describe('assertAdministratorRemains', () => {
  it('allows a change that leaves at least one administrator', () => {
    expect(() => assertAdministratorRemains(1)).not.toThrow();
  });

  it('refuses a change that would leave none', () => {
    expect(capture(() => assertAdministratorRemains(0)).code).toBe('last_administrator');
  });
});

describe('isAdministrativeRole', () => {
  it('detects the permission that can manage the team', () => {
    expect(isAdministrativeRole(['workspace:read', 'member:manage'])).toBe(true);
  });

  it('does not treat a read-only role as administrative', () => {
    expect(isAdministrativeRole(['workspace:read', 'member:read'])).toBe(false);
    expect(isAdministrativeRole([])).toBe(false);
  });
});
