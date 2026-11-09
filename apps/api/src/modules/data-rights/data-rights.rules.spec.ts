import { describe, expect, it } from 'vitest';
import { anonymisedPerson, deadCredentialHash, retentionCutoff } from './data-rights.rules';

describe('anonymisedPerson', () => {
  it('removes every identifying field and keeps the address unique and undeliverable', () => {
    const a = anonymisedPerson('11111111-1111-4111-8111-111111111111');
    const b = anonymisedPerson('22222222-2222-4222-8222-222222222222');

    expect(a).toMatchObject({ firstName: '[erased]', lastName: '[erased]', phone: null });
    expect(a.email.endsWith('@erased.invalid')).toBe(true);
    expect(a.email).not.toBe(b.email);
  });
});

describe('retentionCutoff', () => {
  it('goes back the configured number of months', () => {
    expect(retentionCutoff(new Date('2026-11-09T00:00:00Z'), 12).toISOString()).toBe('2025-11-09T00:00:00.000Z');
  });

  it('clamps to the end of a shorter month instead of overflowing (regression)', () => {
    // 31 March minus one month used to become 3 March (31 February overflowed).
    expect(retentionCutoff(new Date('2026-03-31T00:00:00Z'), 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(retentionCutoff(new Date('2028-03-31T00:00:00Z'), 1).toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });
});

describe('deadCredentialHash', () => {
  it('is different every time, so two erased registrations never collide', () => {
    expect(deadCredentialHash()).not.toBe(deadCredentialHash());
  });
});
