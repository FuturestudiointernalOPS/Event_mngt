import { describe, expect, it } from 'vitest';

/**
 * Runs only against an API started WITH rate limiting (E2E_THROTTLED_URL); the main suite
 * runs with it disabled because it sends hundreds of requests from one address.
 */
const url = process.env.E2E_THROTTLED_URL;

async function post(path: string, body: unknown): Promise<number> {
  const response = await fetch(`${url}/api/v1${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.status;
}

describe.skipIf(!url)('rate limiting', () => {
  it('slows repeated login attempts (brute-force protection) with 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 14; i += 1) {
      statuses.push(await post('/auth/login', { email: 'nobody@example.test', password: 'wrong-password' }));
    }

    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10).every((s) => s === 429)).toBe(true);
  });

  it('limits public registration submissions per client', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 13; i += 1) {
      statuses.push(await post('/public/events/no-such-event/registrations', {
        email: `x${i}@example.test`, firstName: 'A', lastName: 'B', categoryKey: 'visitor', answers: {}, consent: true,
      }));
    }

    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(3);
  });

  it('does not throttle ordinary reads at normal volume', async () => {
    for (let i = 0; i < 20; i += 1) {
      const response = await fetch(`${url}/api/v1/health`);
      expect(response.status).toBe(200);
    }
  });
});
