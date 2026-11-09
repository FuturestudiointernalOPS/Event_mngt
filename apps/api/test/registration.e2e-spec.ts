import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, e2eEnabled, ownerClient, signUp } from './helpers/http';

describe.skipIf(!e2eEnabled)('journey: registration, consent and review', () => {
  const owner = ownerClient();
  const tag = `r${Date.now()}`;
  const slug = `${tag}-org`;
  let admin = { token: '', userId: '' };
  let rival = { token: '', userId: '' };
  let eventId = '';
  let eventSlug = '';
  const staff = (path: string) => `/workspaces/${slug}/events/${eventId}${path}`;
  const person = (n: number, extra: object = {}) => ({
    email: `${tag}-p${n}@example.test`,
    firstName: 'Pat',
    lastName: `Person${n}`,
    categoryKey: 'visitor',
    answers: { company: 'Acme' },
    consent: true,
    ...extra,
  });
  const register = (body: object, headers: Record<string, string> = {}) =>
    call('POST', `/public/events/${eventSlug}/registrations`, { body, headers });

  beforeAll(async () => {
    admin = await signUp(owner, `${tag}-admin@example.test`);
    rival = await signUp(owner, `${tag}-rival@example.test`);
    await call('POST', '/organizations', { token: admin.token, body: { name: 'Reg Org', slug } });
    await call('POST', '/organizations', { token: rival.token, body: { name: 'Rival', slug: `${tag}-rv` } });

    const event = await call('POST', `/workspaces/${slug}/events`, {
      token: admin.token,
      body: {
        name: 'Reg Summit',
        timeZone: 'Africa/Porto-Novo',
        startsAt: '2027-01-10T09:00:00+01:00',
        endsAt: '2027-01-10T17:00:00+01:00',
        visibility: 'PUBLIC',
      },
    });
    eventId = event.data.id;
    eventSlug = event.data.slug;

    await call('PUT', staff('/modules/registration'), {
      token: admin.token,
      body: { enabled: true, settings: { approvalMode: 'manual' } },
    });
    await call('POST', staff('/categories'), {
      token: admin.token,
      body: { key: 'visitor', name: 'Visitor', capacity: 2 },
    });
    await call('POST', staff('/categories'), {
      token: admin.token,
      body: { key: 'startup', name: 'Startup', requiresApproval: true },
    });
    await call('POST', staff('/form-fields'), {
      token: admin.token,
      body: { key: 'company', label: 'Company', type: 'TEXT', required: true },
    });
    await call('POST', staff('/form-fields'), {
      token: admin.token,
      body: { key: 'sector', label: 'Sector', type: 'SELECT', options: ['tech', 'health'] },
    });
    await call('POST', staff('/form-fields'), {
      token: admin.token,
      body: { key: 'pitch', label: 'Pitch', type: 'TEXTAREA', categoryKey: 'startup', required: true },
    });
    await call('PUT', staff('/consent'), {
      token: admin.token,
      body: { text: 'We keep your data to run the event.', version: '2' },
    });
  });

  afterAll(async () => {
    await owner.organization.deleteMany({ where: { slug: { startsWith: tag } } });
    await owner.person.deleteMany({ where: { email: { startsWith: tag } } });
    await owner.user.deleteMany({ where: { email: { startsWith: tag } } });
    await owner.$disconnect();
  });

  it('does not accept registrations before the event is published', async () => {
    expect((await register(person(0))).status).toBe(404);
  });

  it('publishes once the setup is complete', async () => {
    const reply = await call('POST', staff('/publish'), { token: admin.token });
    expect(reply.status).toBe(201);
  });

  it('serves the public form with categories, fields and the consent statement', async () => {
    const form = await call('GET', `/public/events/${eventSlug}/registration-form`);
    expect(form.status).toBe(200);
    expect(form.data.event.registrationOpen).toBe(true);
    expect(form.data.categories.map((c: any) => c.key).sort()).toEqual(['startup', 'visitor']);
    expect(form.data.fields.map((f: any) => f.key)).toContain('pitch');
    expect(form.data.consent).toMatchObject({ version: '2', required: true });
  });

  it('rejects invalid answers, naming each field', async () => {
    const reply = await register(person(1, { answers: { sector: 'oil' } }));
    expect(reply.status).toBe(422);
    expect(reply.error?.code).toBe('invalid_answers');
  });

  it('requires consent', async () => {
    const reply = await register(person(1, { consent: false }));
    expect(reply.error?.code).toBe('consent_required');
  });

  it('registers a visitor as pending, with a portal credential', async () => {
    const reply = await register(person(1), { 'idempotency-key': `${tag}-k1` });
    expect(reply.status).toBe(201);
    expect(reply.data.status).toBe('PENDING');
    expect(reply.data.accessToken).toMatch(/^[0-9a-f-]{36}\.[0-9a-f-]{36}\./);
  });

  it('replays an identical idempotent submit without creating a second registration', async () => {
    const first = await register(person(1), { 'idempotency-key': `${tag}-k1` });
    expect(first.data.replayed).toBe(true);
    expect(first.data.accessToken).toBeNull();
  });

  it('refuses the same e-mail registering twice', async () => {
    const reply = await register(person(1));
    expect(reply.status).toBe(409);
    expect(reply.error?.code).toBe('already_registered');
  });

  it('applies category-specific fields', async () => {
    const missing = await register(person(2, { categoryKey: 'startup' }));
    expect(missing.error?.code).toBe('invalid_answers');
    const ok = await register(person(2, { categoryKey: 'startup', answers: { company: 'S', pitch: 'We build.' } }));
    expect(ok.status).toBe(201);
  });

  it('never exceeds category capacity under concurrent registrations', async () => {
    // visitor capacity is 2 and person 1 already holds a place: only one more may succeed.
    const results = await Promise.all([3, 4, 5, 6, 7].map((n) => register(person(n))));
    const accepted = results.filter((r) => r.status === 201).length;
    const full = results.filter((r) => r.error?.code === 'category_full').length;
    expect(accepted).toBe(1);
    expect(full).toBe(4);
  });

  it('lets staff list, filter and read registrations', async () => {
    const list = await call('GET', staff('/registrations?status=PENDING&pageSize=50'), { token: admin.token });
    expect(list.status).toBe(200);
    expect(list.data.length).toBeGreaterThanOrEqual(3);
    const detail = await call('GET', staff(`/registrations/${list.data[0].id}`), { token: admin.token });
    expect(detail.data.consents[0]).toMatchObject({ purpose: 'registration', policyVersion: '2', granted: true });
  });

  it('confirms a registration once, then refuses contradictory decisions', async () => {
    const list = await call('GET', staff('/registrations?search=Person1'), { token: admin.token });
    const id = list.data[0].id;
    const confirmed = await call('POST', staff(`/registrations/${id}/decision`), {
      token: admin.token,
      body: { decision: 'CONFIRM' },
    });
    expect(confirmed.data.status).toBe('CONFIRMED');
    const reject = await call('POST', staff(`/registrations/${id}/decision`), {
      token: admin.token,
      body: { decision: 'REJECT' },
    });
    expect(reject.error?.code).toBe('invalid_status_transition');
  });

  it('keeps registrations invisible to another organisation', async () => {
    const reply = await call('GET', staff('/registrations'), { token: rival.token });
    expect(reply.status).toBe(403);
  });

  it('refuses to delete a category that has registrations', async () => {
    const categories = await call('GET', staff('/categories'), { token: admin.token });
    const visitor = categories.data.find((c: any) => c.key === 'visitor');
    const reply = await call('DELETE', staff(`/categories/${visitor.id}`), { token: admin.token });
    expect(reply.error?.code).toBe('category_in_use');
  });
});
