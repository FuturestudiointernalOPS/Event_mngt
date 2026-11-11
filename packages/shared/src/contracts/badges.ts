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

/**
 * What a badge QR code encodes. The prefix lets scanners ignore unrelated QR codes and lets
 * the API and every client agree on one format.
 */
export const BADGE_QR_PREFIX = 'ep-badge:';

export function badgeQrPayload(token: string): string {
  return `${BADGE_QR_PREFIX}${token}`;
}

/**
 * The participant-portal credential carried in the e-mailed link: `organizationId.registrationId.token`.
 *
 * The token is the badge token (hashed on the server), so reissuing a badge also invalidates
 * the old link. The organisation and registration ids are routing hints only: access is
 * proven by the secret token, looked up inside that organisation's scope.
 */
export function composeParticipantCredential(
  organizationId: string,
  registrationId: string,
  token: string,
): string {
  return `${organizationId}.${registrationId}.${token}`;
}

export function parseParticipantCredential(
  value: string,
): { organizationId: string; registrationId: string; token: string } | null {
  const parts = value.split('.');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const [organizationId, registrationId, token] = parts;

  if (
    parts.length !== 3 ||
    !organizationId ||
    !registrationId ||
    !token ||
    !uuid.test(organizationId) ||
    !uuid.test(registrationId) ||
    token.length < 16
  ) {
    return null;
  }

  return { organizationId, registrationId, token };
}
