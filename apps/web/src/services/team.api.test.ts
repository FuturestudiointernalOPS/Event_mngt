import { afterEach, describe, expect, it, vi } from 'vitest';
import { teamApi } from './team.api';

afterEach(() => vi.restoreAllMocks());

describe('teamApi.createOrganization', () => {
  it('posts to the onboarding route the API serves (regression: it called a route that returns 404)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            organization: { id: 'o1', slug: 'acme', name: 'Acme', status: 'ACTIVE', createdAt: 'now' },
            member: { id: 'm1', roleId: 'r1', roleKey: 'organisation_admin', status: 'ACTIVE' },
          },
          meta: { requestId: 'r', timestamp: 't' },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await teamApi.createOrganization({ name: 'Acme', timeZone: 'UTC', defaultLocale: 'en' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/onboarding\/organizations$/);
    expect((init as RequestInit).method).toBe('POST');
    expect(result.organization.slug).toBe('acme');
  });
});
