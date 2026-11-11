import { z } from 'zod';

export const purgeExpiredRequestSchema = z.object({
  /** When true nothing is erased; the response only counts what would be. */
  dryRun: z.boolean().default(true),
});

export type PurgeExpiredRequest = z.infer<typeof purgeExpiredRequestSchema>;

export interface PurgeExpiredResult {
  dryRun: boolean;
  /** Null when the workspace has not configured a retention period. */
  retentionMonths: number | null;
  cutoff: string | null;
  people: number;
}
