import { describe, expect, it } from 'vitest';
import { retentionCutoff } from './registrations.retention';

describe('retentionCutoff', () => {
  it('goes back whole calendar months', () => {
    expect(retentionCutoff(new Date('2026-11-11T10:00:00Z'), 12).toISOString()).toBe(
      '2025-11-11T10:00:00.000Z',
    );
  });

  it('does not mutate the input date', () => {
    const now = new Date('2026-11-11T10:00:00Z');
    retentionCutoff(now, 6);
    expect(now.toISOString()).toBe('2026-11-11T10:00:00.000Z');
  });
});
