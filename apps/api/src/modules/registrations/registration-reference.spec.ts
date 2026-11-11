import { describe, expect, it } from 'vitest';
import { createReference, encodeReference } from './registration-reference';

describe('registration references', () => {
  it('encodes a readable, prefixed code', () => {
    expect(encodeReference(Uint8Array.from([0, 1, 2, 3, 4, 5]))).toBe('EP-ABCDEF');
  });

  it('produces a different reference on every call', () => {
    const references = new Set(Array.from({ length: 50 }, () => createReference()));

    expect(references.size).toBe(50);
  });

  it('is uppercase and unambiguous', () => {
    for (let index = 0; index < 20; index += 1) {
      expect(createReference()).toMatch(/^EP-[A-HJ-NP-Z2-9]{6}$/);
    }
  });
});
