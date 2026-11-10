import { generateOpaqueToken, hashOpaqueToken } from '../../common/utils/tokens';

/**
 * Badge tokens, as pure functions (WP-13).
 *
 * The raw token leaves the server once; only its SHA-256 hash is stored. The input is
 * high-entropy random data, so SHA-256 is the right hash (no slow KDF needed).
 */

export const BADGE_QR_PREFIX = 'ep-badge:';

export interface BadgeToken {
  token: string;
  tokenHash: string;
}

export function createBadgeToken(): BadgeToken {
  const token = generateOpaqueToken();

  return { token, tokenHash: hashOpaqueToken(token) };
}

/** The value a QR code encodes. Wave 3 reverses it with `tokenFromQrPayload`. */
export function badgeQrPayload(token: string): string {
  return `${BADGE_QR_PREFIX}${token}`;
}

export function tokenFromQrPayload(payload: string): string | null {
  if (!payload.startsWith(BADGE_QR_PREFIX)) {
    return null;
  }

  const token = payload.slice(BADGE_QR_PREFIX.length);

  return token.length > 0 ? token : null;
}

export function hashBadgeToken(token: string): string {
  return hashOpaqueToken(token);
}
