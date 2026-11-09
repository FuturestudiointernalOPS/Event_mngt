import { describe, expect, it } from 'vitest';
import { decryptSecret, deriveKey, encryptSecret } from './secret-box';

const key = deriveKey('a-test-application-secret-of-enough-length', 'test');

describe('secret box', () => {
  it('round-trips and never repeats a ciphertext', () => {
    const a = encryptSecret('JBSWY3DPEHPK3PXP', key);
    const b = encryptSecret('JBSWY3DPEHPK3PXP', key);

    expect(decryptSecret(a, key)).toBe('JBSWY3DPEHPK3PXP');
    expect(a).not.toBe(b);
    expect(a).not.toContain('JBSWY3DPEHPK3PXP');
  });

  it('refuses a tampered value and a different key', () => {
    const sealed = encryptSecret('secret', key);
    const [iv, tag, body] = sealed.split('.');

    expect(() => decryptSecret(`${iv}.${tag}.${body.slice(0, -2)}AA`, key)).toThrow();
    expect(() => decryptSecret(sealed, deriveKey('another-secret-another-secret-12345', 'test'))).toThrow();
  });

  it('refuses malformed input', () => {
    expect(() => decryptSecret('nope', key)).toThrow();
  });
});
