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

/** Retention purge and category capacity on the real server and database. */
describe.skipIf(!isolationEnabled)('retention and capacity', () => {
  const owner = createOwnerClient();
  let api: RunningApi;
  let fixtures: Fixtures;
  let token = '';
  let eventId = '';
  let eventSlug = '';
  const tag = `ret${Date.now()}`;
  const ws = () => `/workspaces/${fixtures.slugA}`;
  const staff = (method: 'POST' | 'PATCH' | 'PUT', path: string, body?: unknown) => apiSend(api.baseUrl, token, method, path, body);
  const register = async (name: string) => {
    const response = await fetch(`${api.baseUrl}/public/events/${eventSlug}/registrations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `${tag}-${name}@example.test`, firstName: name, lastName: 'Tester', categoryKey: 'visitor', answers: [],
        consents: [{ key: 'privacy', version: 1, accepted: true }],
      }),
    });
    return { status: response.status, body: (await response.json()) as { error?: { code?: string } } };
  };

  beforeAll(async () => {
    await owner.rateLimitCounter.deleteMany();
    fixtures = await createFixtures(owner);
    api = await startApi();
    token = await login(api.baseUrl, fixtures.emailA, fixtures.password);
    const created = await staff('POST', `${ws()}/events`, {
      name: 'Retention Summit', timeZone: 'UTC', startsAt: '2027-06-01T09:00:00Z', endsAt: '2027-06-01T17:00:00Z', visibility: 'PUBLIC',
    });
    eventId = (created.body.data as { id: string }).id;
    eventSlug = (created.body.data as { slug: string }).slug;
    await staff('PATCH', `${ws()}/events/${eventId}/modules`, {
      modules: [{ key: 'registration', enabled: true, settings: { approvalMode: 'manual' } }],
    });
    await staff('POST', `${ws()}/events/${eventId}/categories`, { name: 'Visitor', key: 'visitor', capacity: 2 });
    await staff('POST', `${ws()}/events/${eventId}/consent-documents`, { key: 'privacy', title: 'Privacy', body: 'We keep your data.', required: true });
    expect((await staff('POST', `${ws()}/events/${eventId}/publish`)).status).toBeLessThan(300);
  }, 120_000);

  afterAll(async () => {
    await api?.stop();
    await owner.person.deleteMany({ where: { email: { startsWith: tag } } });
    await destroyFixtures(owner, fixtures);
    await owner.$disconnect();
  });

  it('refuses a registration once a capacity-limited category is full', async () => {
    expect((await register('one')).status).toBe(201);
    expect((await register('two')).status).toBe(201);

    const third = await register('three');
    expect(third.status).toBe(409);
    expect(third.body.error?.code).toBe('category_full');
  });

  it('does nothing until a retention period is set, and rejects a nonsense one', async () => {
    const before = await staff('POST', `${ws()}/retention/purge`, { dryRun: true });
    expect(before.body.data).toMatchObject({ retentionMonths: null, people: 0 });
    expect((await staff('PATCH', `${ws()}/settings`, { retentionMonths: 0 })).status).toBe(400);
  });

  it('previews and then erases people whose events ended before the retention period', async () => {
    expect((await staff('PATCH', `${ws()}/settings`, { retentionMonths: 6 })).status).toBe(200);

    // The event is still in the future: nobody is expired yet.
    expect((await staff('POST', `${ws()}/retention/purge`, { dryRun: false })).body.data).toMatchObject({ people: 0 });

    await owner.event.update({ where: { id: eventId }, data: { startsAt: new Date('2024-01-01T09:00:00Z'), endsAt: new Date('2024-01-02T09:00:00Z') } });

    const preview = await staff('POST', `${ws()}/retention/purge`, { dryRun: true });
    expect(preview.body.data).toMatchObject({ dryRun: true, retentionMonths: 6, people: 2 });
    expect(await owner.person.count({ where: { email: { startsWith: tag } } })).toBe(2);

    const purge = await staff('POST', `${ws()}/retention/purge`, { dryRun: false });
    expect(purge.body.data).toMatchObject({ dryRun: false, people: 2 });
    expect(await owner.person.count({ where: { email: { startsWith: tag } } })).toBe(0);
    expect(await owner.person.count({ where: { organizationId: fixtures.orgA, email: { endsWith: '@erased.invalid' } } })).toBe(2);
    // Registrations survive so counts stay honest.
    expect(await owner.registration.count({ where: { eventId } })).toBe(2);

    expect((await staff('POST', `${ws()}/retention/purge`, { dryRun: false })).body.data).toMatchObject({ people: 0 });
  });

  it('never purges another organisation', async () => {
    const tokenB = await login(api.baseUrl, fixtures.emailB, fixtures.passwordB);
    await apiSend(api.baseUrl, tokenB, 'PATCH', `/workspaces/${fixtures.slugB}/settings`, { retentionMonths: 1 });
    const result = await apiSend(api.baseUrl, tokenB, 'POST', `/workspaces/${fixtures.slugB}/retention/purge`, { dryRun: false });
    expect((result.body.data as { people: number }).people).toBe(0);
  });
});
