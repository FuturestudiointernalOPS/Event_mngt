import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { timeStep, totpAt } from '../src/common/utils/totp';
import { PASSWORD, baseUrl, call, e2eEnabled, ownerClient, signUp } from './helpers/http';

const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe.skipIf(!e2eEnabled)('journey: MFA, event branding, data rights, platform modules', () => {
  const owner = ownerClient();
  const tag = `a${Date.now()}`;
  const login = (email: string, extra: object = {}) =>
    call('POST', '/auth/login', { body: { email, password: PASSWORD, ...extra } });

  afterAll(async () => {
    await owner.organization.deleteMany({ where: { slug: { startsWith: tag } } });
    await owner.person.deleteMany({ where: { email: { contains: tag } } });
    await owner.user.deleteMany({ where: { email: { startsWith: tag } } });
    await owner.$disconnect();
  });

  /* ---------------------------------------------------------------- MFA */

  describe('two-factor authentication', () => {
    const email = `${tag}-mfa@example.test`;
    let token = '';
    let secret = '';
    let recovery: string[] = [];

    beforeAll(async () => {
      token = (await signUp(owner, email)).token;
    });

    it('is off by default and rejects a wrong code during setup', async () => {
      expect((await call('GET', '/auth/mfa', { token })).data).toEqual({ enabled: false, recoveryCodesLeft: 0 });
      const setup = await call('POST', '/auth/mfa/setup', { token });
      secret = setup.data.secret;
      expect(setup.data.otpauthUrl).toContain('otpauth://totp/');
      expect((await call('POST', '/auth/mfa/enable', { token, body: { code: '000000' } })).error?.code).toBe('mfa_invalid');
    });

    it('turns on with a valid code and returns recovery codes once', async () => {
      const code = totpAt(secret, timeStep(new Date()));
      const enabled = await call('POST', '/auth/mfa/enable', { token, body: { code } });
      expect(enabled.status).toBe(200);
      recovery = enabled.data.recoveryCodes;
      expect(recovery).toHaveLength(8);
      expect((await call('GET', '/auth/mfa', { token })).data).toEqual({ enabled: true, recoveryCodesLeft: 8 });
    });

    it('requires the second factor to sign in, and refuses a replayed code', async () => {
      expect((await login(email)).error?.code).toBe('mfa_required');
      // The code used to enable is already spent, so it cannot be replayed.
      expect((await login(email, { mfaCode: totpAt(secret, timeStep(new Date())) })).error?.code).toBe('mfa_invalid');
      // The next time step is still inside the drift window and has not been used.
      const next = await login(email, { mfaCode: totpAt(secret, timeStep(new Date()) + 1) });
      expect(next.status).toBe(200);
    });

    it('accepts each recovery code once', async () => {
      expect((await login(email, { mfaCode: recovery[0] })).status).toBe(200);
      expect((await login(email, { mfaCode: recovery[0] })).error?.code).toBe('mfa_invalid');
    });

    it('turns off with a recovery code, after which sign-in needs no code', async () => {
      const off = await call('POST', '/auth/mfa/disable', { token, body: { code: recovery[1] } });
      expect(off.status).toBe(204);
      expect((await login(email)).status).toBe(200);
    });

    it('locks the account after repeated wrong codes', async () => {
      const lockEmail = `${tag}-lock@example.test`;
      const t = (await signUp(owner, lockEmail)).token;
      const s = (await call('POST', '/auth/mfa/setup', { token: t })).data.secret;
      await call('POST', '/auth/mfa/enable', { token: t, body: { code: totpAt(s, timeStep(new Date())) } });

      for (let i = 0; i < 5; i += 1) {
        expect((await login(lockEmail, { mfaCode: '111111' })).error?.code).toBe('mfa_invalid');
      }
      // Even the right code is refused while locked.
      expect((await login(lockEmail, { mfaCode: totpAt(s, timeStep(new Date()) + 1) })).error?.code).toBe('mfa_locked');
    });
  });

  /* ---------------------------------------------- event branding + banner */

  describe('event-level branding', () => {
    const slug = `${tag}-brand`;
    let admin = { token: '', userId: '' };
    let eventId = '';
    let eventSlug = '';

    beforeAll(async () => {
      admin = await signUp(owner, `${tag}-brandadmin@example.test`);
      await call('POST', '/organizations', { token: admin.token, body: { name: 'Brand Org', slug } });
      const e = await call('POST', `/workspaces/${slug}/events`, {
        token: admin.token,
        body: { name: 'Branded Event', timeZone: 'UTC', startsAt: '2027-03-01T09:00:00Z', endsAt: '2027-03-01T17:00:00Z', visibility: 'PUBLIC' },
      });
      eventId = e.data.id;
      eventSlug = e.data.slug;
      await call('POST', `/workspaces/${slug}/events/${eventId}/publish`, { token: admin.token });
    });

    it('overrides only the chosen colours and inherits the rest', async () => {
      const patched = await call('PATCH', `/workspaces/${slug}/events/${eventId}`, {
        token: admin.token,
        body: { brandOverrides: { primaryColor: '#112233' } },
      });
      expect(patched.data.brandOverrides).toEqual({ primaryColor: '#112233' });

      const page = await call('GET', `/public/events/${eventSlug}/context`);
      expect(page.data.branding.primaryColor).toBe('#112233');
      expect(page.data.branding.secondaryColor).toBe('#206A8A');
    });

    it('rejects a colour that is not a hex value', async () => {
      const bad = await call('PATCH', `/workspaces/${slug}/events/${eventId}`, {
        token: admin.token,
        body: { brandOverrides: { primaryColor: 'red; background:url(x)' } },
      });
      expect(bad.status).toBe(400);
    });

    it('stores a banner image and shows it on the public page, rejecting non-images', async () => {
      const send = async (bytes: Uint8Array) => {
        const form = new FormData();
        form.append('file', new Blob([bytes]), 'banner.png');
        const r = await fetch(`${baseUrl}/api/v1/workspaces/${slug}/events/${eventId}/banner`, {
          method: 'POST',
          headers: { authorization: `Bearer ${admin.token}` },
          body: form,
        });
        return { status: r.status, body: (await r.json()) as any };
      };
      const ok = await send(PNG);
      expect(ok.status).toBe(201);
      expect(ok.body.data.bannerUrl).toMatch(/\/banner-.+\.png$/);
      expect((await call('GET', `/public/events/${eventSlug}/context`)).data.event.bannerUrl).toBe(ok.body.data.bannerUrl);
      expect((await send(new TextEncoder().encode('<script>alert(1)</script>'))).status).toBe(422);
    });

    it('clears the overrides, returning to the workspace colours', async () => {
      await call('PATCH', `/workspaces/${slug}/events/${eventId}`, { token: admin.token, body: { brandOverrides: null } });
      expect((await call('GET', `/public/events/${eventSlug}/context`)).data.branding.primaryColor).toBe('#173F5F');
    });
  });

  /* ---------------------------------------------------------- data rights */

  describe('personal data rights', () => {
    const slug = `${tag}-rights`;
    let admin = { token: '', userId: '' };
    let eventId = '';
    let eventSlug = '';
    let orgId = '';
    const staff = (p: string) => `/workspaces/${slug}/events/${eventId}${p}`;

    async function enrol(name: string) {
      const r = await call('POST', `/public/events/${eventSlug}/registrations`, {
        body: { email: `${tag}-${name}@example.test`, firstName: name, lastName: 'Subject', categoryKey: 'visitor', answers: { company: 'Secret Inc' }, consent: true },
      });
      const secret = `${name}-secret-value-0123456789abcdefghij`;
      await owner.registration.update({ where: { id: r.data.registrationId }, data: { accessTokenHash: sha(secret) } });
      return { id: r.data.registrationId, portal: `${orgId}.${r.data.registrationId}.${secret}` };
    }

    beforeAll(async () => {
      admin = await signUp(owner, `${tag}-rightsadmin@example.test`);
      orgId = (await call('POST', '/organizations', { token: admin.token, body: { name: 'Rights Org', slug } })).data.id;
      const e = await call('POST', `/workspaces/${slug}/events`, {
        token: admin.token,
        body: { name: 'Rights Event', timeZone: 'UTC', startsAt: '2027-04-01T09:00:00Z', endsAt: '2027-04-01T17:00:00Z', visibility: 'PUBLIC' },
      });
      eventId = e.data.id;
      eventSlug = e.data.slug;
      await call('PUT', staff('/modules/registration'), { token: admin.token, body: { enabled: true, settings: { approvalMode: 'automatic' } } });
      await call('POST', staff('/categories'), { token: admin.token, body: { key: 'visitor', name: 'Visitor' } });
      await call('POST', staff('/form-fields'), { token: admin.token, body: { key: 'company', label: 'Company', type: 'TEXT' } });
      await call('PUT', staff('/consent'), { token: admin.token, body: { text: 'We keep your data for the event.', version: '1' } });
      await call('POST', staff('/publish'), { token: admin.token });
    });

    it('lets a participant download their own data', async () => {
      const p = await enrol('ivy');
      const data = await call('GET', '/participant/export', { headers: { 'x-participant-token': p.portal } });
      expect(data.status).toBe(200);
      expect(data.data.person).toMatchObject({ firstName: 'ivy', email: `${tag}-ivy@example.test` });
      expect(data.data.registration.answers).toEqual({ company: 'Secret Inc' });
      expect(data.data.consents[0]).toMatchObject({ purpose: 'registration', granted: true });
    });

    it('erases a participant on request: identity and answers go, the count stays', async () => {
      const p = await enrol('jay');
      expect((await call('POST', '/participant/erase', { headers: { 'x-participant-token': p.portal } })).status).toBe(204);

      expect((await call('GET', '/participant/me', { headers: { 'x-participant-token': p.portal } })).status).toBe(401);
      const row = await owner.registration.findUnique({ where: { id: p.id }, include: { person: true } });
      expect(row?.person.firstName).toBe('[erased]');
      expect(row?.person.email).toContain('@erased.invalid');
      expect(row?.answers).toEqual({});
      expect(row?.status).toBe('CANCELLED');
      expect(await owner.registration.count({ where: { eventId } })).toBeGreaterThanOrEqual(2);
    });

    it('lets staff erase a person too, and allows the same address to register again', async () => {
      const p = await enrol('kit');
      expect((await call('POST', staff(`/registrations/${p.id}/erase`), { token: admin.token })).status).toBe(204);
      const again = await call('POST', `/public/events/${eventSlug}/registrations`, {
        body: { email: `${tag}-kit@example.test`, firstName: 'Kit', lastName: 'Again', categoryKey: 'visitor', answers: { company: 'New' }, consent: true },
      });
      expect(again.status).toBe(201);
    });

    it('needs a configured retention period, previews, then purges only expired data', async () => {
      expect((await call('POST', `/workspaces/${slug}/data-retention/purge`, { token: admin.token, body: { dryRun: true } })).error?.code).toBe('retention_not_configured');
      await call('PUT', `/workspaces/${slug}/data-retention`, { token: admin.token, body: { retentionMonths: 6 } });

      const fresh = await call('POST', `/workspaces/${slug}/data-retention/purge`, { token: admin.token, body: { dryRun: true } });
      expect(fresh.data.eligible).toBe(0);

      await owner.event.update({ where: { id: eventId }, data: { startsAt: new Date('2024-01-01T09:00:00Z'), endsAt: new Date('2024-01-01T17:00:00Z') } });
      const preview = await call('POST', `/workspaces/${slug}/data-retention/purge`, { token: admin.token, body: { dryRun: true } });
      expect(preview.data.eligible).toBeGreaterThanOrEqual(2);
      expect(preview.data.erased).toBe(0);

      const purged = await call('POST', `/workspaces/${slug}/data-retention/purge`, { token: admin.token, body: { dryRun: false } });
      expect(purged.data.erased).toBe(preview.data.eligible);
      expect(await owner.person.count({ where: { organizationId: orgId, erasedAt: null } })).toBe(0);
    });
  });

  /* ------------------------------------------------------ platform modules */

  describe('platform module availability', () => {
    const slug = `${tag}-mods`;
    let admin = { token: '', userId: '' };
    let eventId = '';

    beforeAll(async () => {
      admin = await signUp(owner, `${tag}-modadmin@example.test`);
      await call('POST', '/organizations', { token: admin.token, body: { name: 'Mods Org', slug } });
      eventId = (await call('POST', `/workspaces/${slug}/events`, {
        token: admin.token,
        body: { name: 'Mods Event', timeZone: 'UTC', startsAt: '2027-05-01T09:00:00Z', endsAt: '2027-05-01T17:00:00Z' },
      })).data.id;
      await call('PUT', `/workspaces/${slug}/events/${eventId}/modules/registration`, { token: admin.token, body: { enabled: true } });
      await owner.user.update({ where: { id: admin.userId }, data: { isPlatformAdmin: true } });
    });

    afterAll(async () => {
      await owner.platformModuleSetting.deleteMany({});
    });

    it('lets the platform switch a module off for everyone', async () => {
      const list = await call('GET', '/platform/modules', { token: admin.token });
      expect(list.data.find((m: any) => m.key === 'checkin')).toMatchObject({ available: true, locked: false });

      expect((await call('PUT', '/platform/modules/checkin', { token: admin.token, body: { available: false } })).status).toBe(204);
      const blocked = await call('PUT', `/workspaces/${slug}/events/${eventId}/modules/checkin`, { token: admin.token, body: { enabled: true } });
      expect(blocked.error?.code).toBe('module_unavailable');

      const view = await call('GET', `/workspaces/${slug}/events/${eventId}/modules`, { token: admin.token });
      expect(view.data.find((m: any) => m.key === 'checkin').available).toBe(false);

      await call('PUT', '/platform/modules/checkin', { token: admin.token, body: { available: true } });
      expect((await call('PUT', `/workspaces/${slug}/events/${eventId}/modules/checkin`, { token: admin.token, body: { enabled: true } })).status).toBe(200);
    });

    it('does not let later-phase modules or the core be toggled', async () => {
      expect((await call('PUT', '/platform/modules/agenda', { token: admin.token, body: { available: true } })).error?.code).toBe('module_locked');
      expect((await call('PUT', '/platform/modules/core', { token: admin.token, body: { available: false } })).error?.code).toBe('module_locked');
    });

    it('is closed to people who are not platform administrators', async () => {
      const other = await signUp(owner, `${tag}-plain@example.test`);
      expect((await call('GET', '/platform/modules', { token: other.token })).status).toBe(403);
    });
  });
});
