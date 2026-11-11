import { composeParticipantCredential } from '@event-platform/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  apiSend,
  createFixtures,
  createOwnerClient,
  destroyFixtures,
  isolationEnabled,
  login,
  startApi,
  type Fixtures,
  type RunningApi,
} from './harness';

/**
 * The participant space, executed against the real server and database: access by secret
 * credential only, one registration per credential, and the full journey (profile, directory,
 * meetings, introductions, export, withdraw, erase).
 */
describe.skipIf(!isolationEnabled)('participant space', () => {
  const owner = createOwnerClient();
  let api: RunningApi;
  let fixtures: Fixtures;
  let token = '';
  let eventId = '';
  let eventSlug = '';
  let orgId = '';
  const tag = `portal${Date.now()}`;
  const ws = () => `/workspaces/${fixtures.slugA}`;
  const staff = (method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown) => apiSend(api.baseUrl, token, method, path, body);
  const pub = async (path: string, body: unknown) => {
    const response = await fetch(`${api.baseUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: (await response.json()) as { data?: any; error?: { code?: string } } };
  };
  const as = (credential: string) => ({ 'x-participant-credential': credential });
  const call = async (method: string, path: string, credential: string, body?: unknown) => {
    const response = await fetch(`${api.baseUrl}${path}`, {
      method,
      headers: { ...as(credential), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : {}) as { data?: any; error?: { code?: string } } };
  };

  /** Registers, approves and returns the participant's credential and registration id. */
  async function enrol(name: string): Promise<{ credential: string; registrationId: string }> {
    const receipt = await pub(`/public/events/${eventSlug}/registrations`, {
      email: `${tag}-${name}@example.test`, firstName: name, lastName: 'Tester', categoryKey: 'visitor', answers: [],
      consents: [{ key: 'privacy', version: 1, accepted: true }],
    });
    expect(receipt.status, JSON.stringify(receipt.body)).toBe(201);
    const row = await owner.registration.findFirstOrThrow({ where: { eventId, reference: receipt.body.data.reference } });
    expect((await staff('POST', `${ws()}/events/${eventId}/registrations/${row.id}/approve`, {})).status).toBeLessThan(300);
    // Reissue returns the raw token once, exactly as the e-mail carries it.
    const issued = await staff('POST', `${ws()}/events/${eventId}/registrations/${row.id}/badge/reissue`);
    expect(issued.status).toBeLessThan(300);
    return { credential: composeParticipantCredential(orgId, row.id, (issued.body.data as { token: string }).token), registrationId: row.id };
  }

  beforeAll(async () => {
    // Rate-limit counters persist across runs; start this journey from a clean budget.
    await owner.rateLimitCounter.deleteMany();
    fixtures = await createFixtures(owner);
    api = await startApi();
    token = await login(api.baseUrl, fixtures.emailA, fixtures.password);
    orgId = fixtures.orgA;
    const created = await staff('POST', `${ws()}/events`, {
      name: 'Portal Summit', timeZone: 'UTC', startsAt: '2027-06-01T09:00:00Z', endsAt: '2027-06-01T17:00:00Z', visibility: 'PUBLIC',
    });
    expect(created.status).toBe(201);
    eventId = (created.body.data as { id: string }).id;
    eventSlug = (created.body.data as { slug: string }).slug;
    expect((await staff('PATCH', `${ws()}/events/${eventId}/modules`, {
      modules: [
        { key: 'registration', enabled: true, settings: { approvalMode: 'manual' } },
        { key: 'showcase', enabled: true },
        { key: 'meetings', enabled: true, settings: { requiresStaffConfirmation: false } },
        { key: 'introductions', enabled: true },
      ],
    })).status).toBe(200);
    await staff('POST', `${ws()}/events/${eventId}/categories`, { name: 'Visitor', key: 'visitor' });
    await staff('POST', `${ws()}/events/${eventId}/consent-documents`, { key: 'privacy', title: 'Privacy', body: 'We keep your data.', required: true });
    expect((await staff('POST', `${ws()}/events/${eventId}/publish`)).status).toBeLessThan(300);
  }, 120_000);

  afterAll(async () => {
    await api?.stop();
    await owner.person.deleteMany({ where: { email: { startsWith: tag } } });
    await destroyFixtures(owner, fixtures);
    await owner.$disconnect();
  });

  it('gives events with the same name in different organisations different public addresses', async () => {
    // Regression: the slug was unique only per organisation while /e/:eventSlug is global, so a
    // public registration could resolve to another organisation's event.
    const tokenB = await login(api.baseUrl, fixtures.emailB, fixtures.passwordB);
    const body = { name: 'Portal Summit', timeZone: 'UTC', startsAt: '2027-06-01T09:00:00Z', endsAt: '2027-06-01T17:00:00Z', visibility: 'PUBLIC' };
    const created = await apiSend(api.baseUrl, tokenB, 'POST', `/workspaces/${fixtures.slugB}/events`, body);

    expect(created.status).toBe(201);
    expect((created.body.data as { slug: string }).slug).not.toBe(eventSlug);
    expect(await owner.event.count({ where: { slug: eventSlug } })).toBe(1);
    await expect(
      owner.event.create({
        data: { organizationId: fixtures.orgB, createdByUserId: fixtures.userA, slug: eventSlug, name: 'Clash', timeZone: 'UTC', startsAt: new Date(), endsAt: new Date() },
      }),
    ).rejects.toThrow();
  });

  it('refuses a missing, malformed, forged or other-organisation credential', async () => {
    const { credential } = await enrol('guard');
    const [, regId, secret] = credential.split('.');

    expect((await call('GET', '/participant/me', '')).status).toBe(401);
    expect((await call('GET', '/participant/me', 'garbage')).status).toBe(401);
    expect((await call('GET', '/participant/me', composeParticipantCredential(orgId, regId!, `${secret}x`))).status).toBe(401);
    // A real token presented with another organisation's id proves nothing there.
    expect((await call('GET', '/participant/me', composeParticipantCredential(fixtures.orgB, regId!, secret!))).status).toBe(401);
    expect((await call('GET', '/participant/me', credential)).status).toBe(200);
  });

  it('ends access when the badge is reissued, because the old link carried the old token', async () => {
    const { credential, registrationId } = await enrol('reissue');
    expect((await call('GET', '/participant/me', credential)).status).toBe(200);

    await staff('POST', `${ws()}/events/${eventId}/registrations/${registrationId}/badge/reissue`);

    expect((await call('GET', '/participant/me', credential)).status).toBe(401);
  });

  it('shows a participant only their own space', async () => {
    const ada = await enrol('ada');
    const me = await call('GET', '/participant/me', ada.credential);

    expect(me.body.data.person.firstName).toBe('ada');
    expect(me.body.data.badge.qrPayload).toMatch(/^ep-badge:/);
    expect(me.body.data.modules).toEqual(expect.arrayContaining(['registration', 'showcase', 'meetings']));
  });

  it('runs profile, directory, meeting and introduction end to end between two participants', async () => {
    const ada = await enrol('adaj');
    const ben = await enrol('benj');

    expect((await call('GET', '/participant/meetings', ada.credential)).body.error?.code).toBe('profile_required');
    for (const who of [ada, ben]) {
      const saved = await call('PUT', '/participant/profile', who.credential, { headline: 'Founder', visibility: 'PUBLIC', submitForReview: true });
      expect(saved.status).toBe(200);
    }
    for (const profile of await owner.participantProfile.findMany({ where: { eventId } })) {
      await staff('POST', `${ws()}/events/${eventId}/profiles/${profile.id}/moderate`, { decision: 'APPROVED' });
    }

    const directory = await call('GET', '/participant/directory', ada.credential);
    expect(directory.body.data.map((entry: { displayName: string }) => entry.displayName)).toContain('benj T.');
    expect(JSON.stringify(directory.body.data)).not.toContain('example.test');

    const benProfileId = directory.body.data.find((entry: { displayName: string }) => entry.displayName === 'benj T.').profileId as string;
    const proposed = await call('POST', '/participant/meetings', ada.credential, { recipientProfileId: benProfileId, note: 'Coffee?' });
    expect(proposed.status).toBe(201);
    const meetingId = proposed.body.data.id as string;

    expect((await call('POST', `/participant/meetings/${meetingId}/respond`, ada.credential, { action: 'accept' })).body.error?.code).toBe('not_recipient');
    expect((await call('POST', `/participant/meetings/${meetingId}/respond`, ben.credential, { action: 'accept' })).body.data.status).toBe('ACCEPTED');
    expect((await call('GET', '/participant/meetings', ben.credential)).body.data).toHaveLength(1);

    const intro = await call('POST', '/participant/introductions', ben.credential, { reason: 'Need solar power', offeredHelp: 'Pilot shops' });
    expect(intro.status).toBe(201);
    expect((await call('GET', '/participant/introductions', ben.credential)).body.data).toHaveLength(1);
    // Someone else cannot see it.
    expect((await call('GET', '/participant/introductions', ada.credential)).body.data).toHaveLength(0);
  });

  it('exports the participant\'s own data in a shape the database can actually serve', async () => {
    const eve = await enrol('eve');
    const exported = await call('GET', '/participant/export', eve.credential);

    expect(exported.status).toBe(200);
    expect(exported.body.data.person.email).toBe(`${tag}-eve@example.test`);
    expect(exported.body.data.consents[0]).toMatchObject({ key: 'privacy', version: 1 });
  });

  it('withdraws: the registration is cancelled, the badge revoked and the link stops working', async () => {
    const zoe = await enrol('zoe');
    expect((await call('POST', '/participant/withdraw', zoe.credential)).status).toBe(204);

    expect((await owner.registration.findUniqueOrThrow({ where: { id: zoe.registrationId } })).status).toBe('CANCELLED');
    expect((await owner.badge.findFirstOrThrow({ where: { registrationId: zoe.registrationId } })).status).toBe('REVOKED');
    expect((await call('GET', '/participant/me', zoe.credential)).status).toBe(401);
  });

  it('refuses to withdraw after check-in', async () => {
    const late = await enrol('late');
    await owner.checkIn.create({ data: { organizationId: orgId, eventId, registrationId: late.registrationId, scannedAt: new Date() } });

    expect((await call('POST', '/participant/withdraw', late.credential)).body.error?.code).toBe('already_checked_in');
  });

  it('erases the person on request: identity gone, registration kept for the counts', async () => {
    const kit = await enrol('kit');
    expect((await call('POST', '/participant/erase', kit.credential)).status).toBe(204);

    const row = await owner.registration.findUniqueOrThrow({ where: { id: kit.registrationId }, include: { person: true } });
    expect(row.person.email).toContain('@erased.invalid');
    expect(row.person.firstName).toBe('[erased]');
    expect((await call('GET', '/participant/me', kit.credential)).status).toBe(401);
  });
});
