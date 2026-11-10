import { z } from 'zod';

/**
 * Public, anonymised event metrics (WP-20).
 *
 * A public endpoint cannot return a figure that identifies a person. Two rules keep
 * that true:
 *
 *   1. A count below `PUBLIC_METRICS_MINIMUM` is withheld (`null`), never reported.
 *   2. Every published count is rounded down to a multiple of
 *      `PUBLIC_METRICS_ROUNDING`, so the exact figure is not recoverable by comparing
 *      a total with its buckets.
 *
 * The disclosure block is part of the contract on purpose: the client can explain the
 * method instead of guessing why a number is missing.
 */

export const PUBLIC_METRICS_MINIMUM = 5;
export const PUBLIC_METRICS_ROUNDING = 5;

export const publicMetricCountSchema = z.number().int().min(0).nullable();

export const publicMetricsCategorySchema = z.object({
  key: z.string(),
  name: z.string(),
  count: publicMetricCountSchema,
});

export type PublicMetricsCategory = z.infer<typeof publicMetricsCategorySchema>;

export const publicMetricsSchema = z.object({
  event: z.object({
    slug: z.string(),
    name: z.string(),
  }),
  asOf: z.string(),
  registrations: z.object({
    total: publicMetricCountSchema,
  }),
  participants: z.object({
    total: publicMetricCountSchema,
    organizations: publicMetricCountSchema,
    countries: publicMetricCountSchema,
  }),
  categories: z.array(publicMetricsCategorySchema),
  showcase: z.object({
    profiles: publicMetricCountSchema,
    innovations: publicMetricCountSchema,
  }),
  disclosure: z.object({
    minimumCount: z.number().int().min(1),
    rounding: z.number().int().min(1),
  }),
});

export type PublicMetrics = z.infer<typeof publicMetricsSchema>;
