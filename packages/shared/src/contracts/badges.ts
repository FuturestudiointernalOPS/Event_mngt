import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common';

/**
 * Badge state.
 *
 * The raw token is returned exactly once — at issuance or reissue — and is never part of
 * a list or detail response (WP-13).
 */

export const badgeStatusSchema = z.enum(['ISSUED', 'REVOKED']);
export type BadgeStatus = z.infer<typeof badgeStatusSchema>;

export const badgeSchema = z.object({
  id: uuidSchema,
  registrationId: uuidSchema,
  reference: z.string(),
  status: badgeStatusSchema,
  issuedAt: z.string(),
  revokedAt: z.string().nullable(),
  reissueCount: z.number().int(),
});

export type Badge = z.infer<typeof badgeSchema>;

/** The only shape that contains the token. Treat it like a password. */
export const issuedBadgeSchema = badgeSchema.extend({
  token: z.string(),
});

export type IssuedBadge = z.infer<typeof issuedBadgeSchema>;

export const listBadgesQuerySchema = paginationQuerySchema.extend({
  status: badgeStatusSchema.optional(),
});

export type ListBadgesQuery = z.infer<typeof listBadgesQuerySchema>;
