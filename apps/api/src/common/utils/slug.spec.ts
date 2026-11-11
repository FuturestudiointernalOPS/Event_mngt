import { describe, expect, it } from 'vitest';
import { ensureUniqueSlug, slugify } from './slug';

describe('slug helpers', () => {
  it('folds accents and punctuation', () => {
    expect(slugify('Village de l’Innovation 2026')).toBe('village-de-l-innovation-2026');
  });

  it('uses the requested fallback when nothing slug-able remains', async () => {
    await expect(ensureUniqueSlug('✨✨', async () => false, 'workspace')).resolves.toBe(
      'workspace',
    );
  });

  it('keeps the default fallback for event callers', async () => {
    await expect(ensureUniqueSlug('✨✨', async () => false)).resolves.toBe('event');
  });

  it('appends a suffix until a free candidate is found', async () => {
    const taken = new Set(['village', 'village-2']);

    await expect(
      ensureUniqueSlug('Village', async (candidate) => taken.has(candidate), 'workspace'),
    ).resolves.toBe('village-3');
  });
});
