import { AppException } from '../../common/app-exception';
import { EventStatus, EventVisibility } from '../../database/prisma-client';
import type { EventTransitionAction } from '@event-platform/shared';

/**
 * Event lifecycle rules, as pure functions.
 *
 * Kept free of Nest and of the database so the transitions can be tested directly
 * (R11). The service applies them inside the tenant transaction.
 */

/** Publishing is allowed from any status except the three that mean "over". */
export function assertPublishable(status: EventStatus): void {
  if (status === EventStatus.PUBLISHED) {
    throw AppException.conflict('conflict', 'This event is already published.');
  }

  if (status === EventStatus.CANCELLED || status === EventStatus.ARCHIVED) {
    throw AppException.unprocessable(
      'invalid_status_transition',
      'A cancelled or archived event cannot be published.',
    );
  }
}

/**
 * Publishing activates the publishing module without deleting anything.
 * A private event keeps it disabled.
 */
export function shouldActivatePublishingModule(visibility: EventVisibility): boolean {
  return visibility !== EventVisibility.PRIVATE;
}

interface TransitionRule {
  /** Statuses the transition may start from. */
  from: EventStatus[];
  to: EventStatus;
}

/**
 * The whole lifecycle, in one table: every action names the statuses it may start from
 * and the one it produces. Anything else is refused, so a stale screen cannot move an
 * event backwards or resurrect a cancelled one.
 */
const TRANSITIONS: Record<EventTransitionAction, TransitionRule> = {
  unpublish: { from: [EventStatus.PUBLISHED], to: EventStatus.DRAFT },
  'open-registration': {
    from: [EventStatus.PUBLISHED, EventStatus.REGISTRATION_CLOSED],
    to: EventStatus.REGISTRATION_OPEN,
  },
  'close-registration': {
    from: [EventStatus.REGISTRATION_OPEN],
    to: EventStatus.REGISTRATION_CLOSED,
  },
  complete: {
    from: [
      EventStatus.PUBLISHED,
      EventStatus.REGISTRATION_OPEN,
      EventStatus.REGISTRATION_CLOSED,
    ],
    to: EventStatus.COMPLETED,
  },
  cancel: {
    from: [
      EventStatus.DRAFT,
      EventStatus.PUBLISHED,
      EventStatus.REGISTRATION_OPEN,
      EventStatus.REGISTRATION_CLOSED,
    ],
    to: EventStatus.CANCELLED,
  },
  archive: {
    from: [EventStatus.COMPLETED, EventStatus.CANCELLED],
    to: EventStatus.ARCHIVED,
  },
};

export function nextStatusFor(
  action: EventTransitionAction,
  status: EventStatus,
): EventStatus {
  const rule = TRANSITIONS[action];

  if (!rule.from.includes(status)) {
    throw AppException.unprocessable(
      'invalid_status_transition',
      `A ${status.toLowerCase()} event cannot be moved with "${action}".`,
    );
  }

  return rule.to;
}
