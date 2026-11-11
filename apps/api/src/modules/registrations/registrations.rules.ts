import { AppException } from '../../common/app-exception';
import { EventStatus, RegistrationStatus } from '../../database/prisma-client';

/**
 * Registration state machine, as pure functions (WP-12).
 *
 * The same transition function serves manual approval, rejection and the automatic
 * approval path, so the two routes cannot disagree about what is legal.
 */

export type Decision = 'APPROVED' | 'REJECTED';

const ALLOWED: Record<RegistrationStatus, readonly RegistrationStatus[]> = {
  [RegistrationStatus.PENDING]: [
    RegistrationStatus.APPROVED,
    RegistrationStatus.REJECTED,
    RegistrationStatus.WAITLISTED,
    RegistrationStatus.CANCELLED,
  ],
  [RegistrationStatus.WAITLISTED]: [
    RegistrationStatus.APPROVED,
    RegistrationStatus.REJECTED,
    RegistrationStatus.CANCELLED,
  ],
  [RegistrationStatus.APPROVED]: [],
  [RegistrationStatus.REJECTED]: [],
  [RegistrationStatus.CANCELLED]: [],
};

export function assertDecidable(
  status: RegistrationStatus,
  decision: Decision,
): void {
  if (status === decision) {
    throw AppException.conflict(
      'conflict',
      decision === RegistrationStatus.APPROVED
        ? 'This registration is already approved.'
        : 'This registration is already rejected.',
    );
  }

  if (!ALLOWED[status].includes(decision)) {
    throw AppException.unprocessable(
      'invalid_status_transition',
      `A registration that is ${status.toLowerCase()} cannot be ${decision.toLowerCase()}.`,
    );
  }
}

export interface RegistrationWindowBounds {
  opensAt: Date | null;
  closesAt: Date | null;
}

/**
 * The public submission gate. A closed window, or an event whose lifecycle says it is
 * over, is a business refusal (`422 registration_closed`), not a 404.
 */
export function assertRegistrationOpen(
  status: EventStatus,
  window: RegistrationWindowBounds,
  now: Date = new Date(),
): void {
  const lifecycleClosed =
    status === EventStatus.COMPLETED ||
    status === EventStatus.REGISTRATION_CLOSED ||
    status === EventStatus.CANCELLED ||
    status === EventStatus.ARCHIVED;

  const beforeOpen =
    window.opensAt !== null && now.getTime() < window.opensAt.getTime();
  const afterClose =
    window.closesAt !== null && now.getTime() > window.closesAt.getTime();

  if (lifecycleClosed || beforeOpen || afterClose) {
    throw AppException.unprocessable(
      'registration_closed',
      'Registration is closed for this event.',
    );
  }
}

/** The module setting decides whether a submission waits for a human. */
export function initialStatus(approvalMode: unknown): RegistrationStatus {
  return approvalMode === 'automatic'
    ? RegistrationStatus.APPROVED
    : RegistrationStatus.PENDING;
}

export function duplicatePolicy(value: unknown): 'warn' | 'block' {
  return value === 'block' ? 'block' : 'warn';
}
