import { AppException } from '../../common/app-exception';
import { EventStatus, EventVisibility } from '../../database/prisma-client';

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

export type EventTransition =
  | 'unpublish'
  | 'complete'
  | 'cancel'
  | 'archive'
  | 'open_registration'
  | 'close_registration';

const LIVE: EventStatus[] = [
  EventStatus.PUBLISHED,
  EventStatus.REGISTRATION_OPEN,
  EventStatus.REGISTRATION_CLOSED,
];

/** Where each transition may start, and where it ends. */
const TRANSITIONS: Record<EventTransition, { from: EventStatus[]; to: EventStatus }> = {
  unpublish: { from: [EventStatus.PUBLISHED], to: EventStatus.DRAFT },
  open_registration: {
    from: [EventStatus.PUBLISHED, EventStatus.REGISTRATION_CLOSED],
    to: EventStatus.REGISTRATION_OPEN,
  },
  close_registration: {
    from: [EventStatus.PUBLISHED, EventStatus.REGISTRATION_OPEN],
    to: EventStatus.REGISTRATION_CLOSED,
  },
  complete: { from: LIVE, to: EventStatus.COMPLETED },
  cancel: { from: [EventStatus.DRAFT, ...LIVE], to: EventStatus.CANCELLED },
  archive: {
    from: [EventStatus.DRAFT, EventStatus.COMPLETED, EventStatus.CANCELLED],
    to: EventStatus.ARCHIVED,
  },
};

/** Returns the target status, or refuses a transition the current status does not allow. */
export function resolveTransition(transition: EventTransition, status: EventStatus): EventStatus {
  const rule = TRANSITIONS[transition];

  if (!rule.from.includes(status)) {
    throw AppException.unprocessable(
      'invalid_status_transition',
      `A ${status.toLowerCase().replace(/_/g, ' ')} event cannot be ${transition.replace(/_/g, ' ')}ed.`,
    );
  }

  return rule.to;
}

/** Events that are over keep their content: history must not be rewritten. */
export function assertEditable(status: EventStatus): void {
  if (
    status === EventStatus.COMPLETED ||
    status === EventStatus.CANCELLED ||
    status === EventStatus.ARCHIVED
  ) {
    throw AppException.unprocessable(
      'event_not_editable',
      'A completed, cancelled or archived event can no longer be edited.',
    );
  }
}

/** A shared URL must keep working once the event has left draft. */
export function assertSlugChangeAllowed(status: EventStatus, slugChanged: boolean): void {
  if (slugChanged && status !== EventStatus.DRAFT) {
    throw AppException.unprocessable(
      'slug_locked',
      'The web address can only be changed while the event is a draft.',
    );
  }
}

/** The merged result of an update must still be a valid date range. */
export function assertDateRange(startsAt: Date, endsAt: Date): void {
  if (endsAt <= startsAt) {
    throw AppException.badRequest('invalid_date_range', 'The end must be after the start.');
  }
}

export interface PublishReadiness {
  registrationEnabled: boolean;
  requiresConsent: boolean;
  hasConsentText: boolean;
  activeCategoryCount: number;
}

/** Required settings are validated before an event goes public, with every gap reported. */
export function assertReadyToPublish(facts: PublishReadiness): void {
  const missing: string[] = [];

  if (facts.registrationEnabled) {
    if (facts.activeCategoryCount === 0) {
      missing.push('registration_category');
    }
    if (facts.requiresConsent && !facts.hasConsentText) {
      missing.push('consent_text');
    }
  }

  if (missing.length > 0) {
    throw AppException.unprocessable(
      'event_not_ready',
      'Complete the event setup before publishing.',
      { missing },
    );
  }
}
