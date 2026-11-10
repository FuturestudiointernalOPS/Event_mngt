import { AppException } from '../../common/app-exception';
import {
  ModerationStatus,
  ProfileVisibility,
} from '../../database/prisma-client';

/**
 * Moderation rules, as pure functions (WP-14).
 *
 * Two independent facts make a listing public: a staff decision and the owner's
 * visibility choice. Neither alone is enough.
 */

export type ModerationDecision = 'APPROVED' | 'REJECTED';

/**
 * Any content edit invalidates an approval, so a listing cannot be approved once and
 * then changed freely. `submitForReview` moves the row to the queue.
 */
export function nextModerationStatus(
  existing: ModerationStatus | null,
  submitForReview: boolean,
): ModerationStatus {
  if (submitForReview) {
    return ModerationStatus.PENDING;
  }

  if (
    existing === null ||
    existing === ModerationStatus.APPROVED ||
    existing === ModerationStatus.REJECTED
  ) {
    return ModerationStatus.DRAFT;
  }

  return existing;
}

export function assertModeratable(
  status: ModerationStatus,
  decision: ModerationDecision,
): void {
  if (status === decision) {
    throw AppException.conflict(
      'conflict',
      decision === ModerationStatus.APPROVED
        ? 'This listing is already approved.'
        : 'This listing is already rejected.',
    );
  }

  if (status !== ModerationStatus.PENDING) {
    throw AppException.unprocessable(
      'invalid_status_transition',
      'Submit the listing for review before moderating it.',
    );
  }
}

export function isPubliclyVisible(
  status: ModerationStatus,
  visibility: ProfileVisibility,
): boolean {
  return (
    status === ModerationStatus.APPROVED &&
    visibility === ProfileVisibility.PUBLIC
  );
}

export function defaultVisibility(
  publicByDefault: unknown,
): ProfileVisibility {
  return publicByDefault === true
    ? ProfileVisibility.PUBLIC
    : ProfileVisibility.PRIVATE;
}
