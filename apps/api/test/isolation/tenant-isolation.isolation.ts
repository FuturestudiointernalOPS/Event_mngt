import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  apiGet,
  apiSend,
  createAppClient,
  createFixtures,
  createOwnerClient,
  destroyFixtures,
  isolationEnabled,
  login,
  startApi,
  withScope,
  type Fixtures,
  type RunningApi,
} from './harness';

/**
 * The isolation guarantees from docs/03, executed (WP-02).
 *
 * Database assertions run as the runtime role, so row-level security is engaged.
 * Fixtures are created by the owner connection before any assertion.
 */

// The organisation row itself is public identity by policy (id, slug, name, status of an
// active workspace), so it is deliberately absent here; its tenant-owned children are not.
const DIRECT_TABLES: Array<[table: string, column: string]> = [
  ['organization_members', 'organization_id'],
  ['organization_roles', 'organization_id'],
  ['organization_capabilities', 'organization_id'],
  ['member_capabilities', 'organization_id'],
  ['workspace_settings', 'organization_id'],
  ['workspace_branding', 'organization_id'],
  ['events', 'organization_id'],
  ['audit_logs', 'organization_id'],
  ['invitations', 'organization_id'],
  ['idempotency_records', 'organization_id'],
  ['participant_categories', 'organization_id'],
  ['registration_forms', 'organization_id'],
  ['registration_fields', 'organization_id'],
  ['people', 'organization_id'],
  ['registrations', 'organization_id'],
  ['registration_answers', 'organization_id'],
  ['consent_documents', 'organization_id'],
  ['consent_records', 'organization_id'],
  ['badges', 'organization_id'],
  ['participant_profiles', 'organization_id'],
  ['organization_profiles', 'organization_id'],
  ['innovations', 'organization_id'],
  ['check_ins', 'organization_id'],
  ['meetings', 'organization_id'],
  ['introduction_requests', 'organization_id'],
  ['introduction_status_history', 'organization_id'],
  ['report_exports', 'organization_id'],
];

const CHILD_TABLES: Array<[table: string, countSql: string]> = [
  [
    'event_modules',
    'SELECT count(*)::int AS n FROM event_modules em JOIN events e ON e.id = em.event_id WHERE e.organization_id = $1',
  ],
  [
    'role_permissions',
    'SELECT count(*)::int AS n FROM role_permissions rp JOIN organization_roles r ON r.id = rp.role_id WHERE r.organization_id = $1',
  ],
];

describe.skipIf(!isolationEnabled)('tenant isolation', () => {
  let owner: ReturnType<typeof createOwnerClient>;
  let app: ReturnType<typeof createAppClient>;
  let fixtures: Fixtures;
  let api: RunningApi;
  const extraOrganizations: string[] = [];

  beforeAll(async () => {
    owner = createOwnerClient();
    app = createAppClient();
    fixtures = await createFixtures(owner);
    api = await startApi();
  }, 180_000);

  afterAll(async () => {
    await api?.stop();
    if (extraOrganizations.length > 0) {
      await owner.organization.deleteMany({
        where: { id: { in: extraOrganizations } },
      });
    }
    if (fixtures) {
      await destroyFixtures(owner, fixtures);
    }
    await app?.$disconnect();
    await owner?.$disconnect();
  }, 180_000);

  it('1. reads no tenant rows without a context', async () => {
    const [counts] = await withScope(app, {}, (tx) =>
      tx.$queryRawUnsafe<
        Array<Record<string, number>>
      >(`SELECT
        (SELECT count(*) FROM workspace_settings)::int AS settings,
        (SELECT count(*) FROM workspace_branding)::int AS branding,
        (SELECT count(*) FROM organization_members)::int AS members,
        (SELECT count(*) FROM organization_roles)::int AS roles,
        (SELECT count(*) FROM role_permissions)::int AS grants,
        (SELECT count(*) FROM event_modules)::int AS modules,
        (SELECT count(*) FROM audit_logs)::int AS audit,
        (SELECT count(*) FROM invitations)::int AS invitations,
        (SELECT count(*) FROM participant_categories)::int AS categories,
        (SELECT count(*) FROM registration_forms)::int AS forms,
        (SELECT count(*) FROM registration_fields)::int AS fields,
        (SELECT count(*) FROM people)::int AS people,
        (SELECT count(*) FROM registrations)::int AS registrations,
        (SELECT count(*) FROM registration_answers)::int AS answers,
        (SELECT count(*) FROM consent_documents)::int AS consent_documents,
        (SELECT count(*) FROM consent_records)::int AS consent_records,
        (SELECT count(*) FROM badges)::int AS badges,
        (SELECT count(*) FROM participant_profiles)::int AS participant_profiles,
        (SELECT count(*) FROM organization_profiles)::int AS organization_profiles,
        (SELECT count(*) FROM innovations)::int AS innovations,
        (SELECT count(*) FROM check_ins)::int AS check_ins,
        (SELECT count(*) FROM meetings)::int AS meetings,
        (SELECT count(*) FROM introduction_requests)::int AS introduction_requests,
        (SELECT count(*) FROM introduction_status_history)::int AS introduction_history,
        (SELECT count(*) FROM report_exports)::int AS report_exports,
        (SELECT count(*) FROM events WHERE status = 'DRAFT')::int AS drafts`),
    );

    expect(counts).toEqual({
      settings: 0,
      branding: 0,
      members: 0,
      roles: 0,
      grants: 0,
      modules: 0,
      audit: 0,
      invitations: 0,
      categories: 0,
      forms: 0,
      fields: 0,
      people: 0,
      registrations: 0,
      answers: 0,
      consent_documents: 0,
      consent_records: 0,
      badges: 0,
      participant_profiles: 0,
      organization_profiles: 0,
      innovations: 0,
      check_ins: 0,
      meetings: 0,
      introduction_requests: 0,
      introduction_history: 0,
      report_exports: 0,
      drafts: 0,
    });
  });

  it.each(DIRECT_TABLES)("2. cannot read another tenant's rows in %s", async (table, column) => {
    const [row] = await withScope(app, { org: fixtures.orgA }, (tx) =>
      tx.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int AS n FROM ${table} WHERE ${column} = $1`,
        fixtures.orgB,
      ),
    );

    expect(row.n).toBe(0);
  });

  it.each(CHILD_TABLES)('2. cannot traverse a relation into another tenant via %s', async (_table, sql) => {
    const [row] = await withScope(app, { org: fixtures.orgA }, (tx) =>
      tx.$queryRawUnsafe<Array<{ n: number }>>(sql, fixtures.orgB),
    );

    expect(row.n).toBe(0);
  });

  it("3. cannot update, delete or insert another tenant's rows", async () => {
    const outcome = await withScope(app, { org: fixtures.orgA }, async (tx) => {
      const updated = await tx.$executeRawUnsafe(
        'UPDATE events SET name = $1 WHERE id = $2',
        'hijacked',
        fixtures.eventB,
      );
      const deleted = await tx.$executeRawUnsafe('DELETE FROM events WHERE id = $1', fixtures.eventB);

      return { updated, deleted };
    });

    expect(outcome).toEqual({ updated: 0, deleted: 0 });

    await expect(
      withScope(app, { org: fixtures.orgA }, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO audit_logs (id, organization_id, action, target_type, created_at)
           VALUES (gen_random_uuid(), $1, 'isolation.write', 'test', now())`,
          fixtures.orgB,
        ),
      ),
    ).rejects.toThrow();
  });

  it('4. keeps concurrent tenants apart through the pool', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) => {
        const organizationId = index % 2 === 0 ? fixtures.orgA : fixtures.orgB;
        return withScope(app, { org: organizationId }, (tx) =>
          tx.$queryRawUnsafe<Array<{ organization_id: string }>>(
            'SELECT organization_id FROM events',
          ),
        );
      }),
    );

    results.forEach((rows, index) => {
      const expected = index % 2 === 0 ? fixtures.orgA : fixtures.orgB;

      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(rows.map((row) => row.organization_id))).toEqual(new Set([expected]));
    });
  });

  it('5. never lets a job scoped to A touch B', async () => {
    const affected = await withScope(app, { org: fixtures.orgA }, (tx) =>
      tx.$executeRawUnsafe(
        'UPDATE events SET status = $1 WHERE id = $2',
        'ARCHIVED',
        fixtures.eventB,
      ),
    );

    expect(affected).toBe(0);
  });

  it('6. refuses cross-tenant access through the API', async () => {
    const token = await login(api.baseUrl, fixtures.emailA, fixtures.password);

    const foreignWorkspace = await apiGet(api.baseUrl, token, `/workspaces/${fixtures.slugB}/events`);
    expect(foreignWorkspace.status).toBe(403);

    const foreignEvent = await apiGet(
      api.baseUrl,
      token,
      `/workspaces/${fixtures.slugA}/events/${fixtures.eventB}`,
    );
    expect(foreignEvent.status).toBe(404);
  });

  it('6b. ignores a crafted organisation identifier in the request', async () => {
    const token = await login(api.baseUrl, fixtures.emailA, fixtures.password);

    const forged = await apiGet(
      api.baseUrl,
      token,
      `/workspaces/${fixtures.slugA}/events?organizationId=${fixtures.orgB}`,
    );

    expect(forged.status).toBe(200);

    const items = forged.body.data as Array<{ organizationId: string }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.organizationId === fixtures.orgA)).toBe(true);
  });

  it('6c. reserves the platform portfolio for platform administrators', async () => {
    const memberToken = await login(api.baseUrl, fixtures.emailA, fixtures.password);
    const denied = await apiGet(api.baseUrl, memberToken, '/platform/organizations/overview');
    expect(denied.status).toBe(403);

    const adminToken = await login(
      api.baseUrl,
      fixtures.platformEmail,
      fixtures.platformPassword,
    );
    const portfolio = await apiGet(
      api.baseUrl,
      adminToken,
      '/platform/organizations/overview?pageSize=100',
    );

    expect(portfolio.status).toBe(200);
    const items = portfolio.body.data as Array<{ id: string }>;
    const ids = items.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([fixtures.orgA, fixtures.orgB]));
  });

  it('6d. exposes only aggregate support counts and audits the read', async () => {
    const adminToken = await login(
      api.baseUrl,
      fixtures.platformEmail,
      fixtures.platformPassword,
    );

    const detail = await apiGet(
      api.baseUrl,
      adminToken,
      `/platform/organizations/${fixtures.orgA}`,
    );

    expect(detail.status).toBe(200);
    const row = detail.body.data as {
      id: string;
      members: { total: number; active: number };
    };
    expect(row.id).toBe(fixtures.orgA);
    expect(row.members.total).toBeGreaterThanOrEqual(1);
    expect(row.members.active).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(row)).not.toContain('@example.test');
  });

  it('6e. suspends an organisation and blocks its members immediately', async () => {
    const adminToken = await login(
      api.baseUrl,
      fixtures.platformEmail,
      fixtures.platformPassword,
    );
    const memberToken = await login(api.baseUrl, fixtures.emailA, fixtures.password);

    const suspended = await apiSend(
      api.baseUrl,
      adminToken,
      'PATCH',
      `/platform/organizations/${fixtures.orgA}/status`,
      { status: 'SUSPENDED', reason: 'isolation test' },
    );
    expect(suspended.status).toBe(200);

    const blocked = await apiGet(api.baseUrl, memberToken, `/workspaces/${fixtures.slugA}/events`);
    expect(blocked.status).toBe(403);

    const reactivated = await apiSend(
      api.baseUrl,
      adminToken,
      'PATCH',
      `/platform/organizations/${fixtures.orgA}/status`,
      { status: 'ACTIVE' },
    );
    expect(reactivated.status).toBe(200);

    const restored = await apiGet(api.baseUrl, memberToken, `/workspaces/${fixtures.slugA}/events`);
    expect(restored.status).toBe(200);
  });

  it('6f. onboards a new organisation with the caller as administrator', async () => {
    const memberToken = await login(api.baseUrl, fixtures.emailA, fixtures.password);
    const onboarding = await apiSend(
      api.baseUrl,
      memberToken,
      'POST',
      '/onboarding/organizations',
      { name: `Isolation onboarding ${fixtures.runId}` },
    );

    expect(onboarding.status).toBe(201);
    const result = onboarding.body.data as {
      organization: { id: string; slug: string };
      member: { roleKey: string; status: string };
    };
    extraOrganizations.push(result.organization.id);
    expect(result.member).toMatchObject({
      roleKey: 'organisation_admin',
      status: 'ACTIVE',
    });

    const workspace = await apiGet(
      api.baseUrl,
      memberToken,
      `/workspaces/${result.organization.slug}/events`,
    );
    expect(workspace.status).toBe(200);
  });

  it('6g. creates an organisation on behalf of an existing account', async () => {
    const adminToken = await login(
      api.baseUrl,
      fixtures.platformEmail,
      fixtures.platformPassword,
    );
    const created = await apiSend(
      api.baseUrl,
      adminToken,
      'POST',
      '/platform/organizations',
      {
        name: `Isolation platform ${fixtures.runId}`,
        ownerEmail: fixtures.emailB,
      },
    );

    expect(created.status).toBe(201);
    const detail = created.body.data as {
      id: string;
      members: { total: number; active: number };
    };
    extraOrganizations.push(detail.id);
    expect(detail.members).toMatchObject({ total: 1, active: 1 });

    const ownerToken = await login(api.baseUrl, fixtures.emailB, fixtures.passwordB);
    const owned = await apiGet(
      api.baseUrl,
      ownerToken,
      `/workspaces/${(created.body.data as { slug: string }).slug}/events`,
    );
    expect(owned.status).toBe(200);
  });

  it('7. revokes access on the next request after membership removal', async () => {
    const token = await login(api.baseUrl, fixtures.emailA, fixtures.password);

    const before = await apiGet(api.baseUrl, token, `/workspaces/${fixtures.slugA}/events`);
    expect(before.status).toBe(200);

    await owner.organizationMember.delete({
      where: {
        organizationId_userId: { organizationId: fixtures.orgA, userId: fixtures.userA },
      },
    });

    const after = await apiGet(api.baseUrl, token, `/workspaces/${fixtures.slugA}/events`);
    expect(after.status).toBe(403);
  });
});
