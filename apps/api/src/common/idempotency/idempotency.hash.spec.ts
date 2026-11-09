import { describe, expect, it } from 'vitest';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { hashRequestPayload, stableStringify } from './idempotency.hash';
import { idempotencyScope } from './idempotency.scope';

describe('stableStringify', () => {
  it('is independent of object key order', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
  });

  it('walks nested objects and arrays', () => {
    expect(stableStringify({ list: [{ y: 2, x: 1 }] })).toBe('{"list":[{"x":1,"y":2}]}');
  });

  it('omits undefined keys, matching JSON serialisation', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('keeps array order significant', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});

describe('hashRequestPayload', () => {
  it('hashes reordered bodies identically and different bodies differently', () => {
    expect(hashRequestPayload({ body: { a: 1, b: 2 } })).toBe(
      hashRequestPayload({ body: { b: 2, a: 1 } }),
    );
    expect(hashRequestPayload({ body: { a: 1 } })).not.toBe(
      hashRequestPayload({ body: { a: 2 } }),
    );
  });
});

function request(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    method: 'POST',
    path: '/api/v1/workspaces/acme/events',
    ip: '127.0.0.1',
    headers: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

describe('idempotencyScope', () => {
  it('uses the tenant when a membership was resolved', () => {
    expect(
      idempotencyScope(request(), {
        organizationId: 'org-1',
        userId: 'user-1',
        membershipId: 'member-1',
        permissions: [],
      }),
    ).toBe('org:org-1');
  });

  it('falls back to the account when there is no tenant', () => {
    expect(
      idempotencyScope(
        request({ user: { id: 'user-1', email: 'a@b.test', sessionId: 's', isPlatformAdmin: false } }),
        undefined,
      ),
    ).toBe('user:user-1');
  });

  it('namespaces an anonymous caller by route and address', () => {
    const scope = idempotencyScope(request(), undefined);

    expect(scope).toContain('anon:POST:');
    expect(scope).toContain('127.0.0.1');
    expect(idempotencyScope(request({ ip: '10.0.0.1' }), undefined)).not.toBe(scope);
  });
});
