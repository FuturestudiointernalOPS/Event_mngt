import { generateOpaqueToken, hashOpaqueToken } from '../../common/utils/tokens';

/**
 * Badge tokens, as pure functions (WP-13).
 *
 * The raw token leaves the server once; only its SHA-256 hash is stored. The input is
 * high-entropy random data, so SHA-256 is the right hash (no slow KDF needed).
 */

// The QR format lives in the shared contracts so the API and every client agree on it.
export { BADGE_QR_PREFIX, badgeQrPayload } from '@event-platform/shared';
import { BADGE_QR_PREFIX } from '@event-platform/shared';

export interface BadgeToken {
  token: string;
  tokenHash: string;
}

export function createBadgeToken(): BadgeToken {
  const token = generateOpaqueToken();

  return { token, tokenHash: hashOpaqueToken(token) };
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
