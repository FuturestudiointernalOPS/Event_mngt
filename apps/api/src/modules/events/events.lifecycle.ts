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
