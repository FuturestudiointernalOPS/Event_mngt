import type {
  PublicMetrics,
  PublicMetricsCategory,
} from '@event-platform/shared';
import {
  PUBLIC_METRICS_MINIMUM,
  PUBLIC_METRICS_ROUNDING,
} from '@event-platform/shared';
import type { CategoryCountRow, CategoryRow } from '../reports/reports.shapes';
import type { PublicParticipantStats } from './public-metrics.repository';

/**
 * Anonymisation rules for public figures (WP-20).
 *
 * Two layers, both needed:
 *   1. a small count is withheld, so no bucket names an individual;
 *   2. every published count is rounded down, so a reader cannot subtract buckets
 *      from a total to recover an exact figure.
 */
export function anonymiseCount(
  count: number,
  minimum: number = PUBLIC_METRICS_MINIMUM,
  rounding: number = PUBLIC_METRICS_ROUNDING,
): number | null {
  if (!Number.isFinite(count) || count < minimum) {
    return null;
  }

  return Math.floor(count / rounding) * rounding;
}

export interface PublicMetricsInput {
  event: { slug: string; name: string };
  registrations: number;
  categories: CategoryRow[];
  categoryCounts: CategoryCountRow[];
  participants: PublicParticipantStats;
  publicProfiles: number;
  publicInnovations: number;
  now?: Date;
}

export function buildPublicMetrics(input: PublicMetricsInput): PublicMetrics {
  const countsByCategory = new Map<string, number>();

  for (const row of input.categoryCounts) {
    if (row.categoryId) {
      countsByCategory.set(
        row.categoryId,
        (countsByCategory.get(row.categoryId) ?? 0) + row.count,
      );
    }
  }

  const categories: PublicMetricsCategory[] = input.categories.map((category) => ({
    key: category.key,
    name: category.name,
    count: anonymiseCount(countsByCategory.get(category.id) ?? 0),
  }));

  return {
    event: input.event,
    asOf: (input.now ?? new Date()).toISOString(),
    registrations: {
      total: anonymiseCount(input.registrations),
    },
    participants: {
      total: anonymiseCount(input.participants.total),
      organizations: anonymiseCount(input.participants.withOrganization),
      countries: anonymiseCount(input.participants.countries),
    },
    categories,
    showcase: {
      profiles: anonymiseCount(input.publicProfiles),
      innovations: anonymiseCount(input.publicInnovations),
    },
    disclosure: {
      minimumCount: PUBLIC_METRICS_MINIMUM,
      rounding: PUBLIC_METRICS_ROUNDING,
    },
  };
}
