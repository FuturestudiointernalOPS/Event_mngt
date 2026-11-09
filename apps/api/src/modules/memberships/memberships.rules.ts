import { PERMISSIONS } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';

/**
 * Membership rules, as pure functions (R11).
 *
 * Every invitation rejection shares one code and one message, so a token cannot be
 * probed for existence, expiry or a different address.
 */

export interface InvitationCandidate {
  email: string;
  consumedAt: Date | null;
  expiresAt: Date;
}

export function assertInvitationUsable(
  invitation: InvitationCandidate,
  accountEmail: string,
  now: Date = new Date(),
): void {
  const usable =
    invitation.consumedAt === null &&
    invitation.expiresAt > now &&
    invitation.email.toLowerCase() === accountEmail.toLowerCase();

  if (!usable) {
    throw invalidInvitation();
  }
}

export function invalidInvitation(): AppException {
  return AppException.badRequest(
    'invalid_invitation',
    'This invitation is invalid or has expired.',
  );
}

/** A workspace must always keep at least one person who can manage the team. */
export function assertAdministratorRemains(remainingAdministrators: number): void {
  if (remainingAdministrators < 1) {
    throw AppException.unprocessable(
      'last_administrator',
      'A workspace must keep at least one administrator.',
    );
  }
}

export function isAdministrativeRole(permissionKeys: readonly string[]): boolean {
  return permissionKeys.includes(PERMISSIONS.memberManage);
}
