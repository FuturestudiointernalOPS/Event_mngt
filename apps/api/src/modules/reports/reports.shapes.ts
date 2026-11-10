import type {
  ModerationCounts,
  RegistrationBreakdown,
  RegistrationSourceCounts,
  RegistrationStatusCounts,
  ReportCategory,
} from '@event-platform/shared';
import type {
  BadgeStatus,
  ModerationStatus,
  RegistrationSource,
  RegistrationStatus,
} from '../../database/prisma-client';

/**
 * Row shapes and count shaping for reports (WP-18). Pure functions only, so every
 * projection from grouped rows has a direct unit test.
 */

export interface StatusCountRow {
  status: RegistrationStatus;
  count: number;
}

export interface SourceCountRow {
  source: RegistrationSource;
  count: number;
}

export interface CategoryCountRow {
  categoryId: string | null;
  count: number;
}

export interface CategoryRow {
  id: string;
  key: string;
  name: string;
  capacity: number | null;
}

export interface ModerationCountRow {
  moderationStatus: ModerationStatus;
  count: number;
}

export interface BadgeCountRow {
  status: BadgeStatus;
  count: number;
}

export const EMPTY_STATUS_COUNTS: RegistrationStatusCounts = {
  PENDING: 0,
  APPROVED: 0,
  REJECTED: 0,
  WAITLISTED: 0,
  CANCELLED: 0,
};

export const EMPTY_SOURCE_COUNTS: RegistrationSourceCounts = {
  PUBLIC: 0,
  STAFF: 0,
  IMPORT: 0,
};

export const EMPTY_MODERATION_COUNTS: ModerationCounts = {
  DRAFT: 0,
  PENDING: 0,
  APPROVED: 0,
  REJECTED: 0,
};

export function toStatusCounts(rows: StatusCountRow[]): RegistrationStatusCounts {
  const counts: RegistrationStatusCounts = { ...EMPTY_STATUS_COUNTS };

  for (const row of rows) {
    counts[row.status] += row.count;
  }

  return counts;
}

export function toSourceCounts(rows: SourceCountRow[]): RegistrationSourceCounts {
  const counts: RegistrationSourceCounts = { ...EMPTY_SOURCE_COUNTS };

  for (const row of rows) {
    counts[row.source] += row.count;
  }

  return counts;
}

export function sumStatusCounts(counts: RegistrationStatusCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

/**
 * Approved among decided rows. An event with nothing decided has no rate, which is
 * different from 0% and must stay visible as `null`.
 */
export function approvalRate(counts: RegistrationStatusCounts): number | null {
  const decided = counts.APPROVED + counts.REJECTED;

  return decided === 0 ? null : counts.APPROVED / decided;
}

export function toCategoryReport(
  counts: CategoryCountRow[],
  categories: CategoryRow[],
): ReportCategory[] {
  const byCategory = new Map<string, number>();

  for (const row of counts) {
    if (row.categoryId) {
      byCategory.set(row.categoryId, (byCategory.get(row.categoryId) ?? 0) + row.count);
    }
  }

  return categories.map((category) => ({
    key: category.key,
    name: category.name,
    capacity: category.capacity,
    count: byCategory.get(category.id) ?? 0,
  }));
}

export function toModerationCounts(rows: ModerationCountRow[]): ModerationCounts {
  const counts: ModerationCounts = { ...EMPTY_MODERATION_COUNTS };

  for (const row of rows) {
    counts[row.moderationStatus] += row.count;
  }

  return counts;
}

export function toBadgeCounts(rows: BadgeCountRow[]): { issued: number; revoked: number } {
  let issued = 0;
  let revoked = 0;

  for (const row of rows) {
    if (row.status === 'ISSUED') {
      issued += row.count;
    } else {
      revoked += row.count;
    }
  }

  return { issued, revoked };
}

export function toBreakdown(rows: StatusCountRow[]): RegistrationBreakdown {
  const byStatus = toStatusCounts(rows);

  return { total: sumStatusCounts(byStatus), byStatus };
}
