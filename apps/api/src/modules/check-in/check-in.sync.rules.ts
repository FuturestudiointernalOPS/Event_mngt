import { AppException } from '../../common/app-exception';

/**
 * Offline sync rules, as pure functions (WP-16, R11).
 *
 * The device owns the order of its queue and may be offline for hours. These helpers
 * decide how a batch is ordered and how a future clock is bounded, so the service can
 * stay focused on transactions and outcomes.
 */

/** Matches the check-in module default in the shared registry. */
export const DEFAULT_MAX_CLOCK_SKEW_MINUTES = 5;

export function offlineAllowed(settings: Record<string, unknown>): boolean {
  return settings.allowOffline !== false;
}

export function assertOfflineAllowed(settings: Record<string, unknown>): void {
  if (!offlineAllowed(settings)) {
    throw AppException.unprocessable(
      'offline_disabled',
      'Offline synchronisation is disabled for this event.',
    );
  }
}

/**
 * The module setting, read defensively. The registry validates it before it reaches
 * this module; the fallback only protects a caller that bypassed that read.
 */
export function maxClockSkewMinutes(settings: Record<string, unknown>): number {
  const value = settings.maxClockSkewMinutes;

  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_MAX_CLOCK_SKEW_MINUTES;
}

/** The earliest scan wins, so processing order is ascending `scannedAt`. */
export function sortScansByScannedAt<T extends { scannedAt: string }>(
  scans: readonly T[],
): T[] {
  return [...scans].sort(
    (left, right) =>
      new Date(left.scannedAt).getTime() - new Date(right.scannedAt).getTime(),
  );
}

/**
 * A device clock may run ahead. A timestamp beyond the allowed skew is replaced by the
 * server receive time; `receivedAt` is still stored separately, so the original claim
 * stays auditable.
 */
export function normaliseScannedAt(
  scannedAt: string,
  receivedAt: Date,
  allowedSkewMinutes: number,
): Date {
  const claimed = new Date(scannedAt);
  const limit = receivedAt.getTime() + allowedSkewMinutes * 60_000;

  return claimed.getTime() > limit ? receivedAt : claimed;
}
