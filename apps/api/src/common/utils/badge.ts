import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * QR badge codes and participant access tokens.
 *
 * Badge code:    EP1.<registrationId>.<signature>
 *   The signature is an HMAC over the organisation and registration ids, so a code cannot
 *   be forged or re-pointed at another registration. Check-in devices verify offline by
 *   comparing a hash of the scanned code with a downloaded manifest; the signing secret
 *   never leaves the server.
 *
 * Access token:  <organizationId>.<registrationId>.<secret>
 *   A bearer credential for the participant portal. Only a hash of the secret is stored.
 *   The organisation id is routing information; the secret is what proves access.
 */

const BADGE_PREFIX = 'EP1';

export function signBadge(secret: string, organizationId: string, registrationId: string): string {
  const signature = createHmac('sha256', secret)
    .update(`${organizationId}.${registrationId}`)
    .digest('base64url')
    .slice(0, 22);

  return `${BADGE_PREFIX}.${registrationId}.${signature}`;
}

/** Returns the registration id when the code is well formed and correctly signed. */
export function verifyBadge(
  secret: string,
  organizationId: string,
  code: string,
): { registrationId: string } | null {
  const parts = code.trim().split('.');

  if (parts.length !== 3 || parts[0] !== BADGE_PREFIX) {
    return null;
  }

  const [, registrationId, signature] = parts;
  const expected = signBadge(secret, organizationId, registrationId);
  const given = `${BADGE_PREFIX}.${registrationId}.${signature}`;

  if (expected.length !== given.length) {
    return null;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(given)) ? { registrationId } : null;
}

export function newAccessSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function composeAccessToken(
  organizationId: string,
  registrationId: string,
  secret: string,
): string {
  return `${organizationId}.${registrationId}.${secret}`;
}

export function parseAccessToken(
  token: string,
): { organizationId: string; registrationId: string; secret: string } | null {
  const parts = token.split('.');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (parts.length !== 3 || !uuid.test(parts[0]) || !uuid.test(parts[1]) || parts[2].length < 20) {
    return null;
  }

  return { organizationId: parts[0], registrationId: parts[1], secret: parts[2] };
}
