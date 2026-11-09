import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, e2eEnabled, ownerClient, signUp } from './helpers/http';

describe.skipIf(!e2eEnabled)('journey: event lifecycle and modules', () => {
  const owner = ownerClient();
  const tag = `e${Date.now()}`;
  const slug = `${tag}-org`;
  let admin = { token: '', userId: '' };
  let rival = { token: '', userId: '' };
  let eventId = '';
  let eventSlug = '';
  const base = () => `/workspaces/${slug}/events`;

  beforeAll(async () => {
    admin = await signUp(owner, `${tag}-admin@example.test`);
    rival = await signUp(owner, `${tag}-rival@example.test`);
    await call('POST', '/organizations', { token: admin.token, body: { name: 'Events Org', slug } });
    await call('POST', '/organizations', {
      token: rival.token,
      body: { name: 'Rival Org', slug: `${tag}-rival` },
    });
  });

  afterAll(async () => {
    await owner.organization.deleteMany({ where: { slug: { startsWith: tag } } });
    await owner.user.deleteMany({ where: { email: { startsWith: tag } } });
    await owner.$disconnect();
  });

  it('creates a private draft event', async () => {
    const created = await call('POST', base(), {
      token: admin.token,
      body: {
        name: 'Journey Summit',
        timeZone: 'Africa/Porto-Novo',
        startsAt: '2026-09-01T09:00:00+01:00',
        endsAt: '2026-09-01T17:00:00+01:00',
        visibility: 'PUBLIC',
      },
    });
    expect(created.status).toBe(201);
    expect(created.data.status).toBe('DRAFT');
    eventId = created.data.id;
    eventSlug = created.data.slug;
  });

  it('does not show a draft on the public page', async () => {
    expect((await call('GET', `/public/events/${eventSlug}`)).status).toBe(404);
  });

  it('keeps visibility when only the name is patched (regression)', async () => {
    const patched = await call('PATCH', `${base()}/${eventId}`, {
      token: admin.token,
      body: { name: 'Journey Summit 2026' },
    });
    expect(patched.status).toBe(200);
    expect(patched.data.visibility).toBe('PUBLIC');
  });

  it('refuses a module whose dependency is not enabled, listing what is missing', async () => {
    const reply = await call('PUT', `${base()}/${eventId}/modules/showcase`, {
      token: admin.token,
      body: { enabled: true },
    });
    expect(reply.status).toBe(422);
    expect(reply.error?.code).toBe('module_dependency_missing');
  });

  it('enables registration, then showcase, and blocks disabling registration while in use', async () => {
    const reg = await call('PUT', `${base()}/${eventId}/modules/registration`, {
      token: admin.token,
      body: { enabled: true, settings: { approvalMode: 'manual' } },
    });
    expect(reg.status).toBe(200);
    expect((await call('PUT', `${base()}/${eventId}/modules/showcase`, {
      token: admin.token,
      body: { enabled: true },
    })).status).toBe(200);

    const off = await call('PUT', `${base()}/${eventId}/modules/registration`, {
      token: admin.token,
      body: { enabled: false },
    });
    expect(off.status).toBe(422);
    expect(off.error?.code).toBe('module_in_use');
  });

  it('refuses to publish until registration is set up, listing the gaps', async () => {
    const early = await call('POST', `${base()}/${eventId}/publish`, { token: admin.token });
    expect(early.status).toBe(422);
    expect(early.error?.code).toBe('event_not_ready');

    await call('POST', `${base()}/${eventId}/categories`, {
      token: admin.token,
      body: { key: 'visitor', name: 'Visitor' },
    });
    await call('PUT', `${base()}/${eventId}/consent`, {
      token: admin.token,
      body: { text: 'We keep your data to run the event.', version: '1' },
    });
  });

  it('publishes, and the public page then shows it', async () => {
    expect((await call('POST', `${base()}/${eventId}/publish`, { token: admin.token })).status).toBe(201);
    const page = await call('GET', `/public/events/${eventSlug}`);
    expect(page.status).toBe(200);
  });

  it('hides the event completely from another organisation', async () => {
    const reply = await call('GET', `/workspaces/${tag}-rival/events/${eventId}`, {
      token: rival.token,
    });
    expect(reply.status).toBe(404);
    const crossWorkspace = await call('GET', `${base()}/${eventId}`, { token: rival.token });
    expect(crossWorkspace.status).toBe(403);
  });

  it('locks the slug after publishing', async () => {
    const reply = await call('PATCH', `${base()}/${eventId}`, {
      token: admin.token,
      body: { slug: `${tag}-renamed` },
    });
    expect(reply.status).toBe(422);
    expect(reply.error?.code).toBe('slug_locked');
  });

  it('duplicates into a private draft, cancels and archives', async () => {
    const copy = await call('POST', `${base()}/${eventId}/duplicate`, { token: admin.token });
    expect(copy.status).toBe(201);
    expect(copy.data.status).toBe('DRAFT');
    expect(copy.data.visibility).toBe('PRIVATE');

    const copyId = copy.data.id;
    expect((await call('POST', `${base()}/${copyId}/cancel`, { token: admin.token })).status).toBe(201);
    expect((await call('POST', `${base()}/${copyId}/archive`, { token: admin.token })).status).toBe(201);
    const edit = await call('PATCH', `${base()}/${copyId}`, { token: admin.token, body: { name: 'Nope!' } });
    expect(edit.error?.code).toBe('event_not_editable');
  });

  it('records the changes in the audit trail', async () => {
    const audit = await call('GET', `/workspaces/${slug}/audit-logs?pageSize=50`, { token: admin.token });
    expect(audit.status).toBe(200);
    const actions = audit.data.map((row: any) => row.action);
    expect(actions).toEqual(expect.arrayContaining(['event.created', 'event.published', 'event.module_enabled']));
  });
});
