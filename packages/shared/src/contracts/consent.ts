import { z } from 'zod';
import { keySchema, uuidSchema } from './common';

/**
 * Versioned consent documents.
 *
 * Only the latest published version of a key is required at registration, and a record
 * snapshots the key and version it accepted (docs/11 D2).
 */

export const consentDocumentSchema = z.object({
  id: uuidSchema,
  key: z.string(),
  version: z.number().int(),
  title: z.string(),
  body: z.string(),
  required: z.boolean(),
  publishedAt: z.string().nullable(),
});

export type ConsentDocument = z.infer<typeof consentDocumentSchema>;

export const createConsentDocumentRequestSchema = z.object({
  key: keySchema,
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(20_000),
  required: z.boolean().default(true),
  publish: z.boolean().default(true),
});

export type CreateConsentDocumentRequest = z.infer<
  typeof createConsentDocumentRequestSchema
>;

/** What the public form and the submission rule both read. */
export const consentRequirementSchema = z.object({
  key: z.string(),
  version: z.number().int(),
  title: z.string(),
  body: z.string(),
  required: z.boolean(),
});

export type ConsentRequirement = z.infer<typeof consentRequirementSchema>;

export const consentRecordSchema = z.object({
  key: z.string(),
  version: z.number().int(),
  acceptedAt: z.string(),
});

export type ConsentRecord = z.infer<typeof consentRecordSchema>;
