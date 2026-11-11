import { describe, expect, it } from 'vitest';
import { ensureUniqueSlug, slugify } from './slug';
import { hashOpaqueToken, ttlToSeconds } from './tokens';

describe('slugify', () => {
  it('folds accents and produces url-safe slugs', () => {
    expect(slugify('Innovation Village 2026 — Cotonou')).toBe(
      'innovation-village-2026-cotonou',
    );
  });

  it('trims leading, trailing and repeated separators', () => {
    expect(slugify('  --Salon  des  Startups--  ')).toBe('salon-des-startups');
  });

  it('respects the maximum length', () => {
    expect(slugify('a'.repeat(80), 10)).toHaveLength(10);
  });
});

describe('ensureUniqueSlug', () => {
  it('appends a numeric suffix until the slug is free', async () => {
    const taken = new Set(['village', 'village-2']);
    const exists = async (candidate: string): Promise<boolean> => taken.has(candidate);

    await expect(ensureUniqueSlug('Village', exists)).resolves.toBe('village-3');
  });
});

describe('tokens', () => {
  it('converts duration strings to seconds', () => {
    expect(ttlToSeconds('15m')).toBe(900);
    expect(ttlToSeconds('2h')).toBe(7_200);
    expect(ttlToSeconds('30d')).toBe(2_592_000);
    expect(ttlToSeconds('45s')).toBe(45);
  });

  it('rejects unsupported formats', () => {
    expect(() => ttlToSeconds('fifteen minutes')).toThrow(/Unsupported TTL format/);
  });

  it('hashes deterministically without storing the raw value', () => {
    const token = 'high-entropy-token';
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
    expect(hashOpaqueToken(token)).toHaveLength(64);
    expect(hashOpaqueToken(token)).not.toContain(token);
  });
});
