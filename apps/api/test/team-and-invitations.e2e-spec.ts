import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashOpaqueToken } from '../src/common/utils/tokens';
import type { PrismaClient } from '../src/database/prisma-client';
import {
  api,
  createE2EFixtures,
  createOwnerClient,
  destroyE2EFixtures,
  e2eEnabled,
  expectData,
  login,
  type E2EFixtures,
} from './support/e2e-harness';

/**
 * Team and invitations over HTTP (WP-21).
 *
 * The invitation token is only ever sent by e-mail, so the spec rewrites the stored
 * hash with a known value after the API has created the invitation. That keeps the
 * invite route under test while making acceptance reachable without a mailbox.
 */

interface Member {
  id: string;
  userId: string;
  email: string;
  roleKey: string;
  status: string;
}

interface Role {
  id: string;
  key: string;
}

interface InvitationSummary {
  id: string;
  email: string;
  roleKey: string;
}

interface AcceptResult {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
}

describe.skipIf(!e2eEnabled)('team and invitations (HTTP journey)', () => {
  let owner: PrismaClient;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let inviteeToken: string;

  beforeAll(async () => {
    owner = createOwnerClient();
    fixtures = await createE2EFixtures(owner);
    adminToken = await login(fixtures.adminEmail, fixtures.adminPassword);
    inviteeToken = await login(fixtures.inviteeEmail, fixtures.inviteePassword);
  }, 60_000);

  afterAll(async () => {
    if (fixtures) {
      await destroyE2EFixtures(owner, fixtures);
    }
    await owner?.$disconnect();
  }, 60_000);

  it('lists the team and the roles the team screen can assign', async () => {
    const members = await api<Member[]>(
      'GET',
      `/workspaces/${fixtures.slug}/members`,
      { token: adminToken },
    );

    expect(members.status).toBe(200);
    expect(members.data?.map((member) => member.email)).toContain(fixtures.adminEmail);

    const roles = await api<Role[]>(
      'GET',
      `/workspaces/${fixtures.slug}/roles`,
      { token: adminToken },
    );

    expect(roles.status).toBe(200);
    expect(roles.data?.map((role) => role.key)).toContain('e2e-admin');
  });

  it('invites an address, then lets that account accept', async () => {
    const invited = await api<InvitationSummary>(
      'POST',
      `/workspaces/${fixtures.slug}/invitations`,
      {
        token: adminToken,
        body: { email: fixtures.inviteeEmail, roleId: fixtures.roleId },
      },
    );

    expect(invited.status).toBe(201);
    const invitation = expectData(invited, 'invite member');

    const rawToken = `e2e-invitation-${fixtures.runId}`;

    await owner.invitation.update({
      where: { id: invitation.id },
      data: { tokenHash: hashOpaqueToken(rawToken) },
    });

    const accepted = await api<AcceptResult>(
      'POST',
      `/auth/invitations/${rawToken}/accept`,
      { token: inviteeToken },
    );

    expect(accepted.status).toBe(200);
    expect(accepted.data?.organizationSlug).toBe(fixtures.slug);

    const members = await api<Member[]>(
      'GET',
      `/workspaces/${fixtures.slug}/members`,
      { token: adminToken },
    );

    expect(members.data?.some((member) => member.email === fixtures.inviteeEmail)).toBe(
      true,
    );
  });

  it('revokes a pending invitation', async () => {
    const pendingEmail = `pending-${fixtures.runId}@${fixtures.runId}.e2e.test`;

    const invited = await api<InvitationSummary>(
      'POST',
      `/workspaces/${fixtures.slug}/invitations`,
      {
        token: adminToken,
        body: { email: pendingEmail, roleId: fixtures.roleId },
      },
    );

    expect(invited.status).toBe(201);
    const invitation = expectData(invited, 'invite pending address');

    const revoked = await api(
      'DELETE',
      `/workspaces/${fixtures.slug}/invitations/${invitation.id}`,
      { token: adminToken },
    );

    expect(revoked.status).toBe(204);

    const list = await api<InvitationSummary[]>(
      'GET',
      `/workspaces/${fixtures.slug}/invitations`,
      { token: adminToken },
    );

    expect(list.data?.some((entry) => entry.id === invitation.id)).toBe(false);
  });
});
