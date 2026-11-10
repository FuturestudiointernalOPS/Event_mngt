import { AppException } from '../../common/app-exception';
import { EventStatus, type BadgeStatus } from '../../database/prisma-client';

/**
 * Scan rules, as pure functions (WP-15, R11).
 *
 * Kept free of Nest, the database client and the clock so each refusal can be tested
 * directly. The service applies them inside its tenant transaction.
 */

/** Statuses that mean the event is not running: a scan must be refused. */
const NON_OPERATIONAL_STATUSES: EventStatus[] = [
  EventStatus.DRAFT,
  EventStatus.CANCELLED,
  EventStatus.ARCHIVED,
];

/**
 * A draft exists only for staff, and a cancelled or archived event is over. A completed
 * event still accepts late scans, because attendance is recorded after the fact.
 */
export function assertEventOperational(status: EventStatus): void {
  if (NON_OPERATIONAL_STATUSES.includes(status)) {
    throw AppException.unprocessable(
      'event_not_operational',
      'This event is not accepting check-ins.',
    );
  }
}

/** Only an issued badge proves attendance; expiry is deliberately not modelled. */
export function assertBadgeUsable(status: BadgeStatus): void {
  if (status !== 'ISSUED') {
    throw AppException.unprocessable(
      'badge_revoked',
      'This badge has been revoked.',
    );
  }
}

/** Matches the check-in module default in the shared registry. */
export const DEFAULT_DUPLICATE_WINDOW_MINUTES = 5;

/**
 * The module setting, read defensively. The registry validates it before it reaches
 * this module; the fallback only protects a caller that bypassed that read.
 */
export function duplicateWindowMinutes(settings: Record<string, unknown>): number {
  const value = settings.duplicateWindowMinutes;

  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_DUPLICATE_WINDOW_MINUTES;
}

/**
 * Label a repeat scan. It never decides whether a row is written — the attendance
 * invariant does — only how the repeat is described for operators: a scan inside the
 * window is the same person scanned twice by mistake, a later one is a re-entry.
 */
export type RepeatClassification = 'double_scan' | 're_entry';

export function classifyRepeat(
  originalScannedAt: Date,
  scannedAt: Date,
  windowMinutes: number,
): RepeatClassification {
  const elapsedMinutes =
    Math.abs(scannedAt.getTime() - originalScannedAt.getTime()) / 60_000;

  return elapsedMinutes <= windowMinutes ? 'double_scan' : 're_entry';
}
