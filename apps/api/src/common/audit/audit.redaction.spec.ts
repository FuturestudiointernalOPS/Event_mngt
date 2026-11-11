import { describe, expect, it } from 'vitest';
import { redactMetadata } from './audit.redaction';

describe('redactMetadata', () => {
  it('removes secrets regardless of key casing or separators', () => {
    expect(
      redactMetadata({
        password: 'p',
        passwordHash: 'h',
        refresh_token: 'r',
        'access-token': 'a',
        API_KEY: 'k',
        Authorization: 'Bearer x',
      }),
    ).toEqual({
      password: '[redacted]',
      passwordHash: '[redacted]',
      refresh_token: '[redacted]',
      'access-token': '[redacted]',
      API_KEY: '[redacted]',
      Authorization: '[redacted]',
    });
  });

  it('keeps harmless fields untouched', () => {
    expect(redactMetadata({ email: 'a@b.test', fields: ['name'], count: 2 })).toEqual({
      email: 'a@b.test',
      fields: ['name'],
      count: 2,
    });
  });

  it('walks nested objects and arrays', () => {
    expect(
      redactMetadata({ outer: { inner: [{ token: 't', label: 'ok' }] } }),
    ).toEqual({ outer: { inner: [{ token: '[redacted]', label: 'ok' }] } });
  });

  it('passes through primitives and null', () => {
    expect(redactMetadata('text')).toBe('text');
    expect(redactMetadata(7)).toBe(7);
    expect(redactMetadata(null)).toBeNull();
  });
});
