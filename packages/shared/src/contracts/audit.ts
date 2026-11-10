import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common';

/** Listing is always newest first; only paging is caller-controlled. */
export const auditQuerySchema = paginationQuerySchema.pick({ page: true, pageSize: true });
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export const auditActorSchema = z.object({
  id: uuidSchema,
  email: z.email(),
  displayName: z.string().nullable(),
});

/**
 * One recorded administrative action.
 *
 * `metadata` is deliberately open: each action decides what is useful, but it is
 * redacted before storage, so secrets never reach this shape.
 */
export const auditEntrySchema = z.object({
  id: uuidSchema,
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  actor: auditActorSchema.nullable(),
  metadata: z.unknown().nullable(),
  ipAddress: z.string().nullable(),
  requestId: z.string().nullable(),
  createdAt: z.string(),
});

export type AuditEntry = z.infer<typeof auditEntrySchema>;
