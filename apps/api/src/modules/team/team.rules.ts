import { SYSTEM_ROLES } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';

/**
 * Team rules as pure functions (R11). The service applies them inside the tenant
 * transaction.
 */

/** A workspace must always keep at least one active administrator. */
export function assertAdminRemains(input: {
  targetRoleKey: string;
  targetStatus: string;
  activeAdminCount: number;
  willStillBeActiveAdmin: boolean;
}): void {
  const targetIsActiveAdmin =
    input.targetRoleKey === SYSTEM_ROLES.organisationAdmin && input.targetStatus === 'ACTIVE';

  if (targetIsActiveAdmin && !input.willStillBeActiveAdmin && input.activeAdminCount <= 1) {
    throw AppException.unprocessable(
      'last_admin',
      'A workspace needs at least one active administrator.',
    );
  }
}

export interface InvitationState {
  email: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}

/** The same message for every refusal so a token cannot be probed for its state. */
export function assertInvitationUsable(
  invitation: InvitationState | null,
  userEmail: string,
  now: Date,
): void {
  const usable =
    invitation !== null &&
    invitation.acceptedAt === null &&
    invitation.revokedAt === null &&
    invitation.expiresAt > now &&
    invitation.email.toLowerCase() === userEmail.toLowerCase();

  if (!usable) {
    throw AppException.notFound('invitation_invalid', 'This invitation is invalid or has expired.');
  }
}

export const INVITATION_TTL_DAYS = 7;
