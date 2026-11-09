import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, newTotpSecret, otpauthUrl, timeStep, totpAt, verifyTotp } from './totp';

// RFC 6238 appendix B secret: ASCII "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('base32', () => {
  it('round-trips and matches the RFC 4648 vector', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
    const secret = newTotpSecret();
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });

  it('rejects characters outside the alphabet', () => {
    expect(() => base32Decode('abc1')).toThrow();
  });
});

describe('totpAt (RFC 6238 test vectors, last 6 digits)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('at T=%i the code is %s', (seconds, expected) => {
    expect(totpAt(RFC_SECRET, timeStep(new Date(seconds * 1000)))).toBe(expected);
  });
});

describe('verifyTotp', () => {
  const now = new Date(59 * 1000);

  it('accepts the current code and returns its step', () => {
    expect(verifyTotp(RFC_SECRET, '287082', now, null)).toBe(timeStep(now));
  });

  it('tolerates one step of clock drift but not more', () => {
    const later = new Date(1111111109 * 1000);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, timeStep(later) - 1), later, null)).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, timeStep(later) - 3), later, null)).toBeNull();
  });

  it('refuses a replay of an already accepted step', () => {
    expect(verifyTotp(RFC_SECRET, '287082', now, timeStep(now))).toBeNull();
  });

  it('rejects malformed codes', () => {
    expect(verifyTotp(RFC_SECRET, '12345', now, null)).toBeNull();
    expect(verifyTotp(RFC_SECRET, 'abcdef', now, null)).toBeNull();
  });
});

describe('otpauthUrl', () => {
  it('encodes issuer and account for authenticator apps', () => {
    const url = otpauthUrl('ABC', 'ada@example.com', 'Event Platform');
    expect(url).toContain('otpauth://totp/Event%20Platform:ada%40example.com');
    expect(url).toContain('secret=ABC');
  });
});
