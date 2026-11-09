import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import { assertAdminRemains, assertInvitationUsable } from './team.rules';

function code(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof AppException ? error.code : 'other';
  }
}

describe('assertAdminRemains', () => {
  const lastAdmin = {
    targetRoleKey: 'organisation_admin',
    targetStatus: 'ACTIVE',
    activeAdminCount: 1,
  };

  it('refuses to demote or suspend the only administrator', () => {
    expect(code(() => assertAdminRemains({ ...lastAdmin, willStillBeActiveAdmin: false }))).toBe(
      'last_admin',
    );
  });

  it('allows it when another administrator remains', () => {
    expect(
      code(() =>
        assertAdminRemains({ ...lastAdmin, activeAdminCount: 2, willStillBeActiveAdmin: false }),
      ),
    ).toBeNull();
  });

  it('does not restrict changes to non-administrators', () => {
    expect(
      code(() =>
        assertAdminRemains({
          targetRoleKey: 'event_manager',
          targetStatus: 'ACTIVE',
          activeAdminCount: 1,
          willStillBeActiveAdmin: false,
        }),
      ),
    ).toBeNull();
  });
});

describe('assertInvitationUsable', () => {
  const now = new Date('2026-06-01T10:00:00Z');
  const valid = {
    email: 'Ada@Example.com',
    expiresAt: new Date('2026-06-05T10:00:00Z'),
    acceptedAt: null,
    revokedAt: null,
  };

  it('accepts a live invitation for the matching email, ignoring case', () => {
    expect(code(() => assertInvitationUsable(valid, 'ada@example.com', now))).toBeNull();
  });

  it.each([
    ['missing', null],
    ['expired', { ...valid, expiresAt: new Date('2026-05-31T10:00:00Z') }],
    ['already accepted', { ...valid, acceptedAt: new Date() }],
    ['revoked', { ...valid, revokedAt: new Date() }],
  ])('refuses a %s invitation with the same generic code', (_label, invitation) => {
    expect(code(() => assertInvitationUsable(invitation, 'ada@example.com', now))).toBe(
      'invitation_invalid',
    );
  });

  it('refuses when the signed-in email differs', () => {
    expect(code(() => assertInvitationUsable(valid, 'someone@else.com', now))).toBe(
      'invitation_invalid',
    );
  });
});
