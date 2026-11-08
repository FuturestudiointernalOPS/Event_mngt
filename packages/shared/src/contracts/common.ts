import { z } from 'zod';

/**
 * Every successful API response is wrapped so clients never guess at the shape.
 * See docs/07-api-conventions.md.
 */
export const apiMetaSchema = z.object({
  requestId: z.string(),
  timestamp: z.string(),
  pagination: z
    .object({
      page: z.number().int(),
      pageSize: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    })
    .optional(),
});

export type ApiMeta = z.infer<typeof apiMetaSchema>;

export interface ApiEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: z
    .object({
      requestId: z.string(),
      timestamp: z.string(),
    })
    .optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().trim().min(1).max(60).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const uuidSchema = z.string().uuid();

export const localeSchema = z.enum(['fr', 'en']);
export type Locale = z.infer<typeof localeSchema>;

export const REQUEST_ID_HEADER = 'x-request-id';
export const WORKSPACE_SLUG_HEADER = 'x-workspace-slug';
export const CSRF_TOKEN_HEADER = 'x-csrf-token';
