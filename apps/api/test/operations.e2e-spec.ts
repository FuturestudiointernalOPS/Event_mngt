import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, e2eEnabled, ownerClient, signUp } from './helpers/http';

const sha = (v: string) => createHash('sha256').update(v).digest('hex');

describe.skipIf(!e2eEnabled)('journey: participants, showcase, meetings, introductions, check-in, reports', () => {
  const owner = ownerClient();
  const tag = `o${Date.now()}`;
  const slug = `${tag}-org`;
  let admin = { token: '', userId: '' };
  let eventId = '';
  let eventSlug = '';
  let orgId = '';
  const reg: Record<string, { id: string; portal: string }> = {};
  const staff = (path: string) => `/workspaces/${slug}/events/${eventId}${path}`;
  const as = (who: string) => ({ 'x-participant-token': reg[who].portal });

  /** Registers publicly, then has staff confirm; the portal credential is set through the owner connection. */
  async function enrol(name: string, confirm: boolean, extra: object = {}) {
    const r = await call('POST', `/public/events/${eventSlug}/registrations`, {
      body: {
        email: `${tag}-${name}@example.test`,
        firstName: name,
        lastName: 'Tester',
        categoryKey: 'visitor',
        answers: {},
        consent: true,
        ...extra,
      },
    });
    expect(r.status).toBe(201);
    const id = r.data.registrationId;
    if (confirm) {
      await call('POST', staff(`/registrations/${id}/decision`), { token: admin.token, body: { decision: 'CONFIRM' } });
    }
    const secret = `${name}-secret-value-0123456789abcdefgh`;
    await owner.registration.update({ where: { id }, data: { accessTokenHash: sha(secret) } });
    reg[name] = { id, portal: `${orgId}.${id}.${secret}` };
  }

  beforeAll(async () => {
    admin = await signUp(owner, `${tag}-admin@example.test`);
    const org = await call('POST', '/organizations', { token: admin.token, body: { name: 'Ops Org', slug } });
    orgId = org.data.id;
    const event = await call('POST', `/workspaces/${slug}/events`, {
      token: admin.token,
      body: {
        name: 'Ops Summit',
        timeZone: 'Africa/Porto-Novo',
        startsAt: '2027-02-10T09:00:00+01:00',
        endsAt: '2027-02-10T17:00:00+01:00',
        visibility: 'PUBLIC',
      },
    });
    eventId = event.data.id;
    eventSlug = event.data.slug;
    for (const [key, settings] of [
      ['registration', { approvalMode: 'manual' }],
      ['showcase', {}],
      ['meetings', { maxProposalsPerParticipant: 2 }],
      ['introductions', {}],
      ['checkin', {}],
    ] as const) {
      const r = await call('PUT', staff(`/modules/${key}`), { token: admin.token, body: { enabled: true, settings } });
      expect(r.status).toBe(200);
    }
    await call('POST', staff('/categories'), { token: admin.token, body: { key: 'visitor', name: 'Visitor' } });
    await call('PUT', staff('/consent'), { token: admin.token, body: { text: 'We keep your data for the event.', version: '1' } });
    expect((await call('POST', staff('/publish'), { token: admin.token })).status).toBe(201);

    await enrol('ada', true);
    await enrol('ben', true);
    await enrol('cleo', false);
  });

  afterAll(async () => {
    await owner.organization.deleteMany({ where: { slug: { startsWith: tag } } });
    await owner.person.deleteMany({ where: { email: { startsWith: tag } } });
    await owner.user.deleteMany({ where: { email: { startsWith: tag } } });
    await owner.$disconnect();
  });

  /* ------------------------------------------------------------- portal */

  it('refuses the portal without a valid credential', async () => {
    expect((await call('GET', '/participant/me')).status).toBe(401);
    const forged = await call('GET', '/participant/me', { headers: { 'x-participant-token': `${orgId}.${reg.ada.id}.wrong-secret-wrong-secret-wrong` } });
    expect(forged.status).toBe(401);
  });

  it('shows a confirmed participant their QR badge but a pending one none', async () => {
    const ada = await call('GET', '/participant/me', { headers: as('ada') });
    expect(ada.status).toBe(200);
    expect(ada.data.badgeCode).toMatch(/^EP1\./);
    const cleo = await call('GET', '/participant/me', { headers: as('cleo') });
    expect(cleo.data.badgeCode).toBeNull();
  });

  it('keeps showcase features closed to unconfirmed registrations', async () => {
    const reply = await call('GET', '/participant/directory', { headers: as('cleo') });
    expect(reply.status).toBe(403);
    expect(reply.error?.code).toBe('registration_not_confirmed');
  });

  /* ---------------------------------------------------------- showcase */

  let innovationId = '';

  it('moderates profiles and innovations before they are visible', async () => {
    const profile = await call('PUT', '/participant/profile', {
      headers: as('ada'),
      body: { headline: 'Solar founder', tags: ['energy'], isVisible: true },
    });
    expect(profile.data.status).toBe('PENDING');
    const innovation = await call('POST', '/participant/innovations', {
      headers: as('ada'),
      body: { title: 'SunBox', summary: 'Portable solar for markets.', isVisible: true },
    });
    innovationId = innovation.data.id;

    expect((await call('GET', '/participant/directory', { headers: as('ben') })).data).toHaveLength(0);
    expect((await call('GET', `/public/events/${eventSlug}/showcase`)).data.profiles).toHaveLength(0);

    const profiles = await call('GET', staff('/showcase/profiles'), { token: admin.token });
    await call('POST', staff(`/showcase/profiles/${profiles.data[0].id}/moderation`), { token: admin.token, body: { decision: 'APPROVE' } });
    await call('POST', staff(`/showcase/innovations/${innovationId}/moderation`), { token: admin.token, body: { decision: 'APPROVE' } });

    expect((await call('GET', '/participant/directory', { headers: as('ben') })).data[0].name).toBe('ada Tester');
    const publicShowcase = await call('GET', `/public/events/${eventSlug}/showcase`);
    expect(publicShowcase.data.innovations[0].title).toBe('SunBox');
    expect(JSON.stringify(publicShowcase.data)).not.toContain('example.test');
  });

  /* ---------------------------------------------------------- meetings */

  it('runs a meeting proposal from request to outcome', async () => {
    const self = await call('POST', '/participant/meetings', { headers: as('ben'), body: { inviteeRegistrationId: reg.ben.id } });
    expect(self.error?.code).toBe('invalid_invitee');

    const proposed = await call('POST', '/participant/meetings', {
      headers: as('ben'),
      body: { inviteeRegistrationId: reg.ada.id, message: 'Coffee?' },
    });
    expect(proposed.status).toBe(201);
    const id = proposed.data.id;

    expect((await call('POST', `/participant/meetings/${id}/respond`, { headers: as('ben'), body: { response: 'ACCEPT' } })).error?.code).toBe('not_invitee');
    const accepted = await call('POST', `/participant/meetings/${id}/respond`, { headers: as('ada'), body: { response: 'ACCEPT' } });
    expect(accepted.data.status).toBe('ACCEPTED');

    // The module requires staff confirmation by default: an accepted meeting is not yet final.
    const early = await call('PUT', staff(`/meetings/${id}/outcome`), { token: admin.token, body: { status: 'COMPLETED' } });
    expect(early.error?.code).toBe('invalid_status_transition');
    const confirmed = await call('POST', staff(`/meetings/${id}/confirm`), { token: admin.token });
    expect(confirmed.data.status).toBe('CONFIRMED');

    const done = await call('PUT', staff(`/meetings/${id}/outcome`), { token: admin.token, body: { status: 'COMPLETED', outcome: 'Agreed a pilot.' } });
    expect(done.data.status).toBe('COMPLETED');
  });

  it('enforces the proposal limit from the module settings', async () => {
    // The completed meeting no longer counts: only live proposals (proposed or accepted) do.
    const propose = () => call('POST', '/participant/meetings', { headers: as('ben'), body: { inviteeRegistrationId: reg.ada.id } });
    expect((await propose()).status).toBe(201);
    expect((await propose()).status).toBe(201);
    expect((await propose()).error?.code).toBe('proposal_limit');
  });

  it('lets a participant withdraw, which ends their portal access', async () => {
    await enrol('gus', true);
    expect((await call('POST', '/participant/cancel', { headers: as('gus') })).data.status).toBe('CANCELLED');
    expect((await call('GET', '/participant/me', { headers: as('gus') })).status).toBe(401);
  });

  it('refuses withdrawal after check-in', async () => {
    await enrol('hal', true);
    const hal = await call('GET', '/participant/me', { headers: as('hal') });
    await call('POST', staff('/check-in/scans'), { token: admin.token, body: { code: hal.data.badgeCode } });
    expect((await call('POST', '/participant/cancel', { headers: as('hal') })).error?.code).toBe('already_checked_in');
  });

  it('opens and closes registration explicitly', async () => {
    expect((await call('POST', staff('/close-registration'), { token: admin.token })).data.status).toBe('REGISTRATION_CLOSED');
    const closed = await call('POST', `/public/events/${eventSlug}/registrations`, {
      body: { email: `${tag}-late@example.test`, firstName: 'Late', lastName: 'Comer', categoryKey: 'visitor', answers: {}, consent: true },
    });
    expect(closed.error?.code).toBe('registration_closed');
    expect((await call('POST', staff('/open-registration'), { token: admin.token })).data.status).toBe('REGISTRATION_OPEN');
  });

  /* ----------------------------------------------------- introductions */

  it('takes an introduction request through the staff queue to a recorded outcome', async () => {
    const own = await call('POST', '/participant/introductions', {
      headers: as('ada'),
      body: { innovationId, reason: 'I would like to help.', helpOffered: 'Mentoring' },
    });
    expect(own.error?.code).toBe('own_innovation');

    const requested = await call('POST', '/participant/introductions', {
      headers: as('ben'),
      body: { innovationId, reason: 'My shops need solar power.', helpOffered: 'Pilot customers' },
    });
    expect(requested.status).toBe(201);
    const id = requested.data.id;

    const dup = await call('POST', '/participant/introductions', {
      headers: as('ben'),
      body: { innovationId, reason: 'Asking again for the same.', helpOffered: 'More help' },
    });
    expect(dup.error?.code).toBe('request_exists');

    const assigned = await call('PUT', staff(`/introductions/${id}/assignee`), { token: admin.token, body: { userId: admin.userId } });
    expect(assigned.data.assignedToUserId).toBe(admin.userId);

    const skip = await call('POST', staff(`/introductions/${id}/decision`), { token: admin.token, body: { status: 'INTRODUCED', outcome: 'x' } });
    expect(skip.error?.code).toBe('invalid_status_transition');

    await call('POST', staff(`/introductions/${id}/decision`), { token: admin.token, body: { status: 'APPROVED', note: 'Good fit' } });
    const noOutcome = await call('POST', staff(`/introductions/${id}/decision`), { token: admin.token, body: { status: 'INTRODUCED' } });
    expect(noOutcome.error?.code).toBe('outcome_required');
    const introduced = await call('POST', staff(`/introductions/${id}/decision`), { token: admin.token, body: { status: 'INTRODUCED', outcome: 'Met at the fair.' } });
    expect(introduced.data.status).toBe('INTRODUCED');
    expect(introduced.data.history.map((h: any) => h.toStatus)).toEqual(['SUBMITTED', 'APPROVED', 'INTRODUCED']);

    const mine = await call('GET', '/participant/introductions', { headers: as('ben') });
    expect(mine.data[0].status).toBe('INTRODUCED');
  });

  /* ----------------------------------------------------------- check-in */

  it('validates badges offline from hashes, and records one attendance per participant', async () => {
    const ada = await call('GET', '/participant/me', { headers: as('ada') });
    const manifest = await call('GET', staff('/check-in/manifest'), { token: admin.token });
    expect(manifest.data.map((m: any) => m.codeHash)).toContain(sha(ada.data.badgeCode));
    expect(JSON.stringify(manifest.data)).not.toContain(ada.data.badgeCode);

    const first = await call('POST', staff('/check-in/scans'), { token: admin.token, body: { code: ada.data.badgeCode } });
    expect(first.data.result).toBe('checked_in');
    const again = await call('POST', staff('/check-in/scans'), { token: admin.token, body: { code: ada.data.badgeCode } });
    expect(again.data.result).toBe('duplicate');

    const forged = await call('POST', staff('/check-in/scans'), { token: admin.token, body: { code: ada.data.badgeCode.slice(0, -3) + 'AAA' } });
    expect(forged.data.result).toBe('invalid');

    const pending = await call('POST', staff('/check-in/scans'), { token: admin.token, body: { registrationId: reg.cleo.id, source: 'MANUAL' } });
    expect(pending.data.result).toBe('not_confirmed');
  });

  it('syncs offline scans idempotently', async () => {
    const ben = await call('GET', '/participant/me', { headers: as('ben') });
    const batch = { scans: [{ code: ben.data.badgeCode, source: 'OFFLINE', clientScanId: `${tag}-device-1`, scannedAt: '2027-02-10T09:05:00+01:00' }] };
    const first = await call('POST', staff('/check-in/sync'), { token: admin.token, body: batch });
    expect(first.data[0].result).toBe('checked_in');
    const resent = await call('POST', staff('/check-in/sync'), { token: admin.token, body: batch });
    expect(resent.data[0].result).toBe('checked_in');
    const stats = await call('GET', staff('/check-in/stats'), { token: admin.token });
    expect(stats.data).toMatchObject({ confirmed: 3, checkedIn: 3 });
  });

  it('records exactly one attendance when several devices scan the same badge at once', async () => {
    await enrol('dana', true);
    const dana = await call('GET', '/participant/me', { headers: as('dana') });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => call('POST', staff('/check-in/scans'), { token: admin.token, body: { code: dana.data.badgeCode } })),
    );
    const kinds = results.map((r) => r.data?.result);
    expect(kinds.filter((k) => k === 'checked_in')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'duplicate')).toHaveLength(5);
    expect(await owner.checkIn.count({ where: { registrationId: reg.dana.id } })).toBe(1);
  });

  /* ------------------------------------------------------------ reports */

  it('reports scoped figures for the event and the organisation', async () => {
    const summary = await call('GET', staff('/reports/summary'), { token: admin.token });
    expect(summary.data.registrations.total).toBe(6);
    expect(summary.data.registrations.byStatus).toMatchObject({ CONFIRMED: 4, PENDING: 1, CANCELLED: 1 });
    expect(summary.data.attendance.checkedIn).toBe(4);
    expect(summary.data.introductions).toMatchObject({ INTRODUCED: 1 });

    const overview = await call('GET', `/workspaces/${slug}/reports/overview`, { token: admin.token });
    expect(overview.data.registrations).toBe(6);
  });

  it('exports CSV with formula injection neutralised', async () => {
    await enrol('evil', false, { firstName: '=HYPERLINK("http://x")' });
    const response = await fetch(`${process.env.E2E_BASE_URL}/api/v1${staff('/reports/registrations.csv')}`, {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(response.headers.get('content-type')).toContain('text/csv');
    const csv = await response.text();
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv.split('\r\n')[0]).toBe('first_name,last_name,email,phone,category,status,checked_in,registered_at');
  });

  it('suppresses public figures for groups that are too small to be anonymous', async () => {
    const stats = await call('GET', `/public/events/${eventSlug}/stats`);
    expect(stats.status).toBe(200);
    expect(stats.data.registrations).toBeNull();
    expect(stats.data.byCategory[0].count).toBeNull();
  });

  it('keeps reports closed to a role without report permission', async () => {
    const outsider = await signUp(owner, `${tag}-outsider@example.test`);
    expect((await call('GET', staff('/reports/summary'), { token: outsider.token })).status).toBe(403);
  });

  /* ----------------------------------------------------------- platform */

  it('restricts the platform console and lets an administrator suspend a workspace', async () => {
    expect((await call('GET', '/platform/overview', { token: admin.token })).status).toBe(403);

    await owner.user.update({ where: { id: admin.userId }, data: { isPlatformAdmin: true } });
    const overview = await call('GET', '/platform/overview', { token: admin.token });
    expect(overview.status).toBe(200);
    expect(overview.data.organisationList.map((o: any) => o.slug)).toContain(slug);

    expect((await call('PUT', `/platform/organizations/${orgId}/status`, { token: admin.token, body: { status: 'SUSPENDED' } })).status).toBe(204);
    expect((await call('GET', `/workspaces/${slug}/context`)).status).toBe(404);
    expect((await call('GET', `/public/events/${eventSlug}`)).status).toBe(404);

    await call('PUT', `/platform/organizations/${orgId}/status`, { token: admin.token, body: { status: 'ACTIVE' } });
    expect((await call('GET', `/workspaces/${slug}/context`)).status).toBe(200);
  });
});
