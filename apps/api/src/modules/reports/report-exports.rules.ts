import type { ExportFormat, ExportStatus } from '@event-platform/shared';

/**
 * Export policy in one place (WP-19).
 *
 * Downloads are snapshot files with a short life: the bytes stay in the database for
 * `EXPORT_RETENTION_DAYS`, then the row remains as history and the file is refused.
 */

export const MAX_EXPORT_ROWS = 10_000;
export const EXPORT_RETENTION_DAYS = 7;

export const EXPORT_CONTENT_TYPES: Record<ExportFormat, string> = {
  CSV: 'text/csv; charset=utf-8',
  PDF: 'application/pdf',
};

export const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  CSV: 'csv',
  PDF: 'pdf',
};

export type DownloadBlocker = 'failed' | 'not_ready' | 'expired';

function sanitiseSegment(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return cleaned.length > 0 ? cleaned : 'event';
}

function timestamp(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');

  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    '-',
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join('');
}

/** A stable, filesystem-safe name. It is display metadata, never a storage key. */
export function exportFileName(
  eventSlug: string,
  format: ExportFormat,
  now: Date,
): string {
  return `registrations-${sanitiseSegment(eventSlug)}-${timestamp(now)}.${EXPORT_EXTENSIONS[format]}`;
}

export function exportExpiry(now: Date): Date {
  return new Date(now.getTime() + EXPORT_RETENTION_DAYS * 86_400_000);
}

export function isExpired(expiresAt: Date | null, now: Date): boolean {
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}

/**
 * Why a download cannot start, in the order the user needs to understand it. A failed
 * export is reported as failed even if it would also be expired.
 */
export function downloadBlocker(
  status: ExportStatus,
  expiresAt: Date | null,
  now: Date,
): DownloadBlocker | null {
  if (status === 'FAILED') {
    return 'failed';
  }

  if (status !== 'COMPLETED') {
    return 'not_ready';
  }

  return isExpired(expiresAt, now) ? 'expired' : null;
}

/** The message stored on a failed row never contains a database error. */
export const EXPORT_FAILURE_MESSAGE = 'The export could not be generated.';
