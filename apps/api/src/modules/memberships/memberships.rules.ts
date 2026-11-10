import {
  CAPABILITY_KEYS,
  capabilitiesBeyond,
  capabilitiesForPermissions,
  resolveEffectiveCapabilities,
} from '@event-platform/shared';
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

/**
 * A person may only put somebody into a role whose effective capabilities they hold
 * themselves. Without this, invite-only access becomes a path to a stronger role than
 * the inviter has.
 */
export function assertRoleWithinActorCapabilities(
  actorCapabilities: readonly string[],
  organizationCapabilities: readonly string[],
  rolePermissions: readonly string[],
): void {
  const effective = resolveEffectiveCapabilities({
    organization: organizationCapabilities,
    role: capabilitiesForPermissions(rolePermissions),
    direct: [],
  });
  const beyond = capabilitiesBeyond(actorCapabilities, effective);

  if (beyond.length > 0) {
    throw AppException.forbidden(
      'role_escalation_denied',
      'You cannot assign a role with capabilities you do not hold yourself.',
      { capabilities: beyond },
    );
  }
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

export function isAdministrativeCapabilities(
  rolePermissions: readonly string[],
  directCapabilities: readonly string[] = [],
): boolean {
  const capabilities = [
    ...capabilitiesForPermissions(rolePermissions),
    ...directCapabilities,
  ];
  return capabilities.includes(CAPABILITY_KEYS.organizationManagePermissions);
}

/** @deprecated Kept for callers that only have a role. Prefer isAdministrativeCapabilities. */
export function isAdministrativeRole(permissionKeys: readonly string[]): boolean {
  return isAdministrativeCapabilities(permissionKeys);
}
