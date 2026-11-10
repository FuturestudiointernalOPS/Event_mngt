import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common';

/**
 * Check-in and offline scan sync (WP-15, WP-16).
 *
 * The raw badge token is only ever an input: it is hashed for lookup and never stored
 * or echoed. A repeat scan returns the existing attendance row with `duplicate: true`.
 */

const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const checkInSourceSchema = z.enum(['ONLINE', 'OFFLINE', 'MANUAL']);
export type CheckInSource = z.infer<typeof checkInSourceSchema>;

export const checkInParticipantSchema = z.object({
  displayName: z.string(),
  category: z.string().nullable(),
});

export type CheckInParticipant = z.infer<typeof checkInParticipantSchema>;

export const createCheckInRequestSchema = z.union([
  z.object({
    badgeToken: z.string().trim().min(1).max(512),
    scanId: uuidSchema.optional(),
    scannedAt: isoDateTimeSchema,
  }),
  /**
   * Staff check-in without a token. The badge token is never retrievable, so a manual
   * check-in identifies the registration instead of guessing a credential.
   */
  z.object({
    registrationId: uuidSchema,
    scanId: uuidSchema.optional(),
    scannedAt: isoDateTimeSchema,
  }),
]);

export type CreateCheckInRequest = z.infer<typeof createCheckInRequestSchema>;

export const checkInSchema = z.object({
  id: uuidSchema,
  registrationId: uuidSchema,
  reference: z.string(),
  participant: checkInParticipantSchema,
  source: checkInSourceSchema,
  scannedAt: z.string(),
  receivedAt: z.string(),
  duplicate: z.boolean(),
});

export type CheckIn = z.infer<typeof checkInSchema>;

export const listCheckInsQuerySchema = paginationQuerySchema;
export type ListCheckInsQuery = z.infer<typeof listCheckInsQuerySchema>;

export const checkInCategorySummarySchema = z.object({
  key: z.string(),
  name: z.string(),
  checkedIn: z.number().int(),
});

export type CheckInCategorySummary = z.infer<typeof checkInCategorySummarySchema>;

export const checkInSummarySchema = z.object({
  total: z.number().int(),
  /** Attendance per participant category, so the event screen can show who is arriving. */
  byCategory: z.array(checkInCategorySummarySchema),
});

export type CheckInSummary = z.infer<typeof checkInSummarySchema>;

// ---------------------------------------------------------------------------
// Offline sync — one outcome per scan, in the device's order (WP-16)
// ---------------------------------------------------------------------------

export const syncScanSchema = z.object({
  scanId: uuidSchema,
  badgeToken: z.string().trim().min(1).max(512),
  scannedAt: isoDateTimeSchema,
});

export type SyncScan = z.infer<typeof syncScanSchema>;

export const MAX_SYNC_SCANS = 500;

export const syncCheckInsRequestSchema = z.object({
  deviceId: z.string().trim().min(1).max(120).optional(),
  scans: z.array(syncScanSchema).min(1).max(MAX_SYNC_SCANS),
});

export type SyncCheckInsRequest = z.infer<typeof syncCheckInsRequestSchema>;

export const syncResultStatusSchema = z.enum(['created', 'duplicate', 'rejected']);
export type SyncResultStatus = z.infer<typeof syncResultStatusSchema>;

export const syncScanResultSchema = z.object({
  scanId: uuidSchema,
  status: syncResultStatusSchema,
  checkInId: uuidSchema.optional(),
  code: z.string().optional(),
  participant: checkInParticipantSchema.optional(),
});

export type SyncScanResult = z.infer<typeof syncScanResultSchema>;

export const syncCheckInsResponseSchema = z.object({
  results: z.array(syncScanResultSchema),
  counts: z.object({
    created: z.number().int(),
    duplicate: z.number().int(),
    rejected: z.number().int(),
  }),
});

export type SyncCheckInsResponse = z.infer<typeof syncCheckInsResponseSchema>;
