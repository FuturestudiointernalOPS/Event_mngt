import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common';
import { registrationSourceSchema, registrationStatusSchema } from './registrations';

/**
 * Reporting read models and report exports (WP-18, WP-19).
 *
 * Every count is scoped to one organisation and, for event reports, one event. The
 * contracts are staff-facing: they may carry internal ids because the route also
 * requires `report:read`. Public figures live in `contracts/analytics.ts`.
 */

export const registrationStatusCountsSchema = z.object({
  PENDING: z.number().int().min(0),
  APPROVED: z.number().int().min(0),
  REJECTED: z.number().int().min(0),
  WAITLISTED: z.number().int().min(0),
  CANCELLED: z.number().int().min(0),
});

export type RegistrationStatusCounts = z.infer<typeof registrationStatusCountsSchema>;

export const registrationSourceCountsSchema = z.object({
  PUBLIC: z.number().int().min(0),
  STAFF: z.number().int().min(0),
  IMPORT: z.number().int().min(0),
});

export type RegistrationSourceCounts = z.infer<typeof registrationSourceCountsSchema>;

export const registrationBreakdownSchema = z.object({
  total: z.number().int().min(0),
  byStatus: registrationStatusCountsSchema,
});

export type RegistrationBreakdown = z.infer<typeof registrationBreakdownSchema>;

export const moderationCountsSchema = z.object({
  DRAFT: z.number().int().min(0),
  PENDING: z.number().int().min(0),
  APPROVED: z.number().int().min(0),
  REJECTED: z.number().int().min(0),
});

export type ModerationCounts = z.infer<typeof moderationCountsSchema>;

export const reportCategorySchema = z.object({
  key: z.string(),
  name: z.string(),
  capacity: z.number().int().nullable(),
  count: z.number().int().min(0),
});

export type ReportCategory = z.infer<typeof reportCategorySchema>;

export const eventReportTimelinePointSchema = z.object({
  /** UTC calendar day, `YYYY-MM-DD`. */
  date: z.string(),
  count: z.number().int().min(0),
});

export type EventReportTimelinePoint = z.infer<typeof eventReportTimelinePointSchema>;

export const eventReportSchema = z.object({
  event: z.object({
    id: uuidSchema,
    name: z.string(),
    slug: z.string(),
    status: z.string(),
    startsAt: z.string(),
    endsAt: z.string(),
  }),
  generatedAt: z.string(),
  registrations: z.object({
    total: z.number().int().min(0),
    byStatus: registrationStatusCountsSchema,
    bySource: registrationSourceCountsSchema,
    byCategory: z.array(reportCategorySchema),
    last7Days: z.number().int().min(0),
    last30Days: z.number().int().min(0),
    /**
     * Approved among decided (approved + rejected). `null` while nothing has been
     * decided, so a fresh event is not reported as a 0% approval rate.
     */
    approvalRate: z.number().min(0).max(1).nullable(),
  }),
  participants: z.object({
    total: z.number().int().min(0),
    withOrganization: z.number().int().min(0),
    countries: z.number().int().min(0),
  }),
  showcase: z.object({
    profiles: moderationCountsSchema,
    innovations: moderationCountsSchema,
  }),
  badges: z.object({
    issued: z.number().int().min(0),
    revoked: z.number().int().min(0),
  }),
  timeline: z.array(eventReportTimelinePointSchema),
});

export type EventReport = z.infer<typeof eventReportSchema>;

export const organizationReportEventSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  status: z.string(),
  startsAt: z.string(),
  parentEventId: uuidSchema.nullable(),
  registrations: registrationBreakdownSchema,
});

export type OrganizationReportEvent = z.infer<typeof organizationReportEventSchema>;

export const organizationReportSchema = z.object({
  generatedAt: z.string(),
  totals: z.object({
    events: z.number().int().min(0),
    publishedEvents: z.number().int().min(0),
    registrations: registrationBreakdownSchema,
  }),
  events: z.array(organizationReportEventSchema),
});

export type OrganizationReport = z.infer<typeof organizationReportSchema>;

export const editionComparisonEntrySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  startsAt: z.string(),
  status: z.string(),
  registrations: registrationBreakdownSchema,
});

export type EditionComparisonEntry = z.infer<typeof editionComparisonEntrySchema>;

export const editionComparisonSchema = z.object({
  generatedAt: z.string(),
  root: z.object({ id: uuidSchema, name: z.string(), slug: z.string() }).nullable(),
  editions: z.array(editionComparisonEntrySchema),
});

export type EditionComparison = z.infer<typeof editionComparisonSchema>;

// ---------------------------------------------------------------------------
// Exports (WP-19)
// ---------------------------------------------------------------------------

export const exportKindSchema = z.enum(['REGISTRATIONS']);
export type ExportKind = z.infer<typeof exportKindSchema>;

export const exportFormatSchema = z.enum(['CSV', 'PDF']);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const exportStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);
export type ExportStatus = z.infer<typeof exportStatusSchema>;

export const createReportExportRequestSchema = z.object({
  format: exportFormatSchema,
  kind: exportKindSchema.default('REGISTRATIONS'),
});

export type CreateReportExportRequest = z.infer<typeof createReportExportRequestSchema>;

export const reportExportSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  kind: exportKindSchema,
  format: exportFormatSchema,
  status: exportStatusSchema,
  fileName: z.string(),
  contentType: z.string(),
  rowCount: z.number().int().min(0),
  byteSize: z.number().int().min(0),
  /** True when the export hit the server-side row cap. */
  truncated: z.boolean(),
  error: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
});

export type ReportExport = z.infer<typeof reportExportSchema>;

export const listReportExportsQuerySchema = paginationQuerySchema
  .pick({ page: true, pageSize: true })
  .extend({ status: exportStatusSchema.optional() });

export type ListReportExportsQuery = z.infer<typeof listReportExportsQuerySchema>;

/** Re-exported so a consumer does not import the registration contracts directly. */
export const reportRegistrationStatusSchema = registrationStatusSchema;
export const reportRegistrationSourceSchema = registrationSourceSchema;
