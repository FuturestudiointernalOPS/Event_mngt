import type { APIRequestContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';

export const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
export const PASSWORD = 'Str0ng-Passw0rd!x';

/**
 * Rate-limit counters persist in the database, and every spec registers a fresh account from
 * the same address, so the register budget (5 per 10 minutes) would stop a full run. The
 * counters hold only hashed keys; clearing them in the local test database is harmless.
 */
function resetRateLimits(): void {
  execFileSync('docker', ['exec', 'eventplat-pg', 'psql', '-U', 'postgres', '-d', 'eventplat', '-qc',
    'delete from rate_limit_counters']);
}

/** Marks the account verified, as clicking the e-mailed link would (local Docker database). */
function verify(email: string): void {
  execFileSync('docker', ['exec', 'eventplat-pg', 'psql', '-U', 'postgres', '-d', 'eventplat', '-qc',
    `update users set status='ACTIVE', email_verified_at=now() where email='${email.replace(/'/g, "''")}'`]);
}

export interface Seeded {
  email: string;
  token: string;
  slug: string;
  eventId: string;
  eventSlug: string;
}

/** A signed-up admin with a published event that accepts registrations. */
export async function seedEvent(request: APIRequestContext, withShowcase = false): Promise<Seeded> {
  const tag = `pw${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `${tag}@example.test`;
  const slug = `${tag}-org`;
  const json = { 'content-type': 'application/json' };

  resetRateLimits();
  await request.post(`${API}/api/v1/auth/register`, { data: { email, password: PASSWORD, displayName: 'Playwright' } });
  verify(email);
  const login = await (await request.post(`${API}/api/v1/auth/login`, { data: { email, password: PASSWORD } })).json();
  const token = login.data.accessToken as string;
  const auth = { ...json, authorization: `Bearer ${token}` };

  await request.post(`${API}/api/v1/onboarding/organizations`, { headers: auth, data: { name: 'Playwright Org', slug } });
  const event = await (await request.post(`${API}/api/v1/workspaces/${slug}/events`, {
    headers: auth,
    data: { name: 'Playwright Summit', timeZone: 'UTC', startsAt: '2027-06-01T09:00:00Z', endsAt: '2027-06-01T17:00:00Z', visibility: 'PUBLIC' },
  })).json();
  const eventId = event.data.id as string;
  const base = `${API}/api/v1/workspaces/${slug}/events/${eventId}`;
  const keys = ['registration', 'checkin', ...(withShowcase ? ['showcase'] : [])];
  await request.patch(`${base}/modules`, {
    headers: auth,
    data: { modules: keys.map((key) => ({ key, enabled: true, ...(key === 'registration' && { settings: { approvalMode: 'manual' } }) })) },
  });
  await request.post(`${base}/categories`, { headers: auth, data: { key: 'visitor', name: 'Visitor' } });
  await request.post(`${base}/consent-documents`, {
    headers: auth,
    data: { key: 'privacy', title: 'Privacy', body: 'We keep your data to run the event.', required: true },
  });
  const published = await request.post(`${base}/publish`, { headers: auth });
  if (!published.ok()) throw new Error(`publish failed: ${published.status()}`);

  return { email, token, slug, eventId, eventSlug: event.data.slug };
}
