import { describe, expect, it } from 'vitest';
import {
  emailFromBody,
  rateLimitKey,
  retryAfterSeconds,
  windowStart,
} from './rate-limit.rules';

describe('windowStart', () => {
  it('floors a timestamp to the start of its window', () => {
    const now = new Date('2026-11-09T10:00:37.500Z');

    expect(windowStart(now, 60).toISOString()).toBe('2026-11-09T10:00:00.000Z');
    expect(windowStart(now, 30).toISOString()).toBe('2026-11-09T10:00:30.000Z');
  });
});

describe('retryAfterSeconds', () => {
  it('never returns less than one second and stays inside the window', () => {
    const start = new Date('2026-11-09T10:00:00.000Z');
    const now = new Date('2026-11-09T10:00:59.000Z');

    expect(retryAfterSeconds(now, start, 60)).toBe(1);
    expect(retryAfterSeconds(start, start, 60)).toBe(60);
  });
});

describe('rateLimitKey', () => {
  it('keeps the address in an IP key', () => {
    expect(rateLimitKey('login', 'ip', '203.0.113.7')).toBe('login:ip:203.0.113.7');
  });

  it('hashes an email so the counter never stores the address', () => {
    const key = rateLimitKey('login', 'email', ' Person@Example.Test ');

    expect(key).not.toContain('person');
    expect(key).not.toContain('@');
    expect(key).toBe(rateLimitKey('login', 'email', 'person@example.test'));
  });

  it('separates buckets so one route cannot exhaust another', () => {
    expect(rateLimitKey('login', 'ip', '1.2.3.4')).not.toBe(
      rateLimitKey('register', 'ip', '1.2.3.4'),
    );
  });

  it('keys an account budget by the stable user id', () => {
    expect(rateLimitKey('mfa-enable', 'user', 'user-9')).toBe(
      'mfa-enable:user:user-9',
    );
  });
});

describe('emailFromBody', () => {
  it('reads a non-empty string and ignores anything else', () => {
    expect(emailFromBody({ email: 'a@b.test' })).toBe('a@b.test');
    expect(emailFromBody({ email: '   ' })).toBeUndefined();
    expect(emailFromBody({ email: 42 })).toBeUndefined();
    expect(emailFromBody(null)).toBeUndefined();
  });
});
