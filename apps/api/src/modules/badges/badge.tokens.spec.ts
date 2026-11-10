import { describe, expect, it } from 'vitest';
import {
  BADGE_QR_PREFIX,
  badgeQrPayload,
  createBadgeToken,
  hashBadgeToken,
  tokenFromQrPayload,
} from './badge.tokens';

describe('badge tokens', () => {
  it('returns a token whose hash is the stored value', () => {
    const { token, tokenHash } = createBadgeToken();

    expect(token.length).toBeGreaterThan(30);
    expect(tokenHash).toBe(hashBadgeToken(token));
    expect(tokenHash).not.toBe(token);
  });

  it('produces a different token every time', () => {
    expect(createBadgeToken().token).not.toBe(createBadgeToken().token);
  });

  it('round-trips the QR payload', () => {
    const { token } = createBadgeToken();

    expect(badgeQrPayload(token)).toBe(`${BADGE_QR_PREFIX}${token}`);
    expect(tokenFromQrPayload(badgeQrPayload(token))).toBe(token);
  });

  it('rejects a payload from another format', () => {
    expect(tokenFromQrPayload('https://example.test/badge')).toBeNull();
    expect(tokenFromQrPayload(BADGE_QR_PREFIX)).toBeNull();
  });
});
