import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, e2eEnabled, ownerClient, signUp } from './helpers/http';

describe.skipIf(!e2eEnabled)('journey: workspace, team and invitations', () => {
  const owner = ownerClient();
  const tag = `t${Date.now()}`;
  let admin = { token: '', userId: '' };
  let guest = { token: '', userId: '' };
  let outsider = { token: '', userId: '' };
  const slug = `${tag}-org`;

  beforeAll(async () => {
    admin = await signUp(owner, `${tag}-admin@example.test`);
    guest = await signUp(owner, `${tag}-guest@example.test`);
    outsider = await signUp(owner, `${tag}-out@example.test`);
  });

  afterAll(async () => {
    await owner.organization.deleteMany({ where: { slug: { startsWith: tag } } });
    await owner.user.deleteMany({ where: { email: { startsWith: tag } } });
    await owner.$disconnect();
  });

  it('creates a workspace and makes the creator its administrator', async () => {
    const created = await call('POST', '/organizations', {
      token: admin.token,
      body: { name: 'Team Org', slug },
    });
    expect(created.status).toBe(201);

    const me = await call('GET', '/auth/me', { token: admin.token });
    expect(me.data.memberships.map((m: any) => m.organizationSlug)).toContain(slug);
  });

  it('refuses a workspace address that is taken', async () => {
    const again = await call('POST', '/organizations', {
      token: outsider.token,
      body: { name: 'Clash', slug },
    });
    expect(again.status).toBe(409);
    expect(again.error?.code).toBe('slug_taken');
  });

  it('shows the workspace publicly with default branding', async () => {
    const context = await call('GET', `/workspaces/${slug}/context`);
    expect(context.status).toBe(200);
    expect(context.data.organization.slug).toBe(slug);
  });

  it('keeps the team routes closed to someone outside the workspace', async () => {
    const reply = await call('GET', `/workspaces/${slug}/team/members`, { token: outsider.token });
    expect(reply.status).toBe(403);
  });

  it('refuses demoting the only administrator', async () => {
    const members = await call('GET', `/workspaces/${slug}/team/members`, { token: admin.token });
    const self = members.data.find((m: any) => m.userId === admin.userId);
    const reply = await call('PATCH', `/workspaces/${slug}/team/members/${self.id}`, {
      token: admin.token,
      body: { roleKey: 'event_manager' },
    });
    expect(reply.status).toBe(422);
    expect(reply.error?.code).toBe('last_admin');
  });

  it('invites someone, who accepts with the matching account only', async () => {
    const invited = await call('POST', `/workspaces/${slug}/team/invitations`, {
      token: admin.token,
      body: { email: `${tag}-guest@example.test`, roleKey: 'event_manager' },
    });
    expect(invited.status).toBe(201);

    // The raw token only exists in the e-mail; recover a usable one through the owner
    // connection by replacing the stored hash with a hash we know.
    const { createHash } = await import('node:crypto');
    const raw = 'known-test-token-0123456789abcdef';
    await owner.organizationInvitation.update({
      where: { id: invited.data.id },
      data: { tokenHash: createHash('sha256').update(raw).digest('hex') },
    });

    const wrongUser = await call('POST', '/invitations/accept', {
      token: outsider.token,
      body: { workspaceSlug: slug, token: raw },
    });
    expect(wrongUser.status).toBe(404);

    const accepted = await call('POST', '/invitations/accept', {
      token: guest.token,
      body: { workspaceSlug: slug, token: raw },
    });
    expect(accepted.status).toBe(200);

    const reuse = await call('POST', '/invitations/accept', {
      token: guest.token,
      body: { workspaceSlug: slug, token: raw },
    });
    expect(reuse.status).toBe(404);

    const members = await call('GET', `/workspaces/${slug}/team/members`, { token: admin.token });
    expect(members.data.map((m: any) => m.email)).toContain(`${tag}-guest@example.test`);
  });

  it('applies the invited role: an event manager cannot manage the team', async () => {
    const reply = await call('POST', `/workspaces/${slug}/team/invitations`, {
      token: guest.token,
      body: { email: 'x@example.test', roleKey: 'event_manager' },
    });
    expect(reply.status).toBe(403);
  });
});
