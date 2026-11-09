import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from './prisma-client';

/**
 * Cross-tenant isolation against a real PostgreSQL with the RLS policies applied.
 *
 * Skipped unless both URLs are set, so the normal test run needs no database:
 *   TEST_OWNER_DATABASE_URL  migration owner, used only to seed and clean up
 *   TEST_APP_DATABASE_URL    the non-owner platform_app role the API runs as
 * See docs/03-tenant-isolation-and-rls.md.
 */
const ownerUrl = process.env.TEST_OWNER_DATABASE_URL;
const appUrl = process.env.TEST_APP_DATABASE_URL;

function client(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

describe.skipIf(!ownerUrl || !appUrl)('tenant isolation (row-level security)', () => {
  const owner = client(ownerUrl ?? '');
  const app = client(appUrl ?? '');
  const tag = `iso-${Date.now()}`;
  const ids = { orgA: '', orgB: '', eventA: '', eventB: '', user: '' };

  const asTenant = <T>(organizationId: string, fn: (tx: Parameters<Parameters<typeof app.$transaction>[0]>[0]) => Promise<T>) =>
    app.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
      return fn(tx);
    });

  beforeAll(async () => {
    const user = await owner.user.create({
      data: { email: `${tag}@example.test`, passwordHash: 'x' },
    });
    const makeOrg = (suffix: string) =>
      owner.organization.create({ data: { slug: `${tag}-${suffix}`, name: `Org ${suffix}` } });
    const [orgA, orgB] = await Promise.all([makeOrg('a'), makeOrg('b')]);
    const makeEvent = (organizationId: string, slug: string) =>
      owner.event.create({
        data: {
          organizationId,
          createdByUserId: user.id,
          slug,
          name: slug,
          timeZone: 'UTC',
          startsAt: new Date('2026-06-01T09:00:00Z'),
          endsAt: new Date('2026-06-01T17:00:00Z'),
          modules: { create: [{ moduleKey: 'core' }] },
        },
      });
    const [eventA, eventB] = await Promise.all([
      makeEvent(orgA.id, `${tag}-event-a`),
      makeEvent(orgB.id, `${tag}-event-b`),
    ]);
    Object.assign(ids, {
      orgA: orgA.id,
      orgB: orgB.id,
      eventA: eventA.id,
      eventB: eventB.id,
      user: user.id,
    });
  });

  afterAll(async () => {
    await owner.organization.deleteMany({ where: { slug: { startsWith: tag } } });
    await owner.user.deleteMany({ where: { email: `${tag}@example.test` } });
    await Promise.all([owner.$disconnect(), app.$disconnect()]);
  });

  it('shows organisation A only its own events', async () => {
    const events = await asTenant(ids.orgA, (tx) =>
      tx.event.findMany({ where: { slug: { startsWith: tag } } }),
    );

    expect(events.map((e) => e.id)).toEqual([ids.eventA]);
  });

  it('shows organisation B only its own events', async () => {
    const events = await asTenant(ids.orgB, (tx) =>
      tx.event.findMany({ where: { slug: { startsWith: tag } } }),
    );

    expect(events.map((e) => e.id)).toEqual([ids.eventB]);
  });

  it("hides the other tenant's row even when queried by its exact id", async () => {
    const found = await asTenant(ids.orgA, (tx) =>
      tx.event.findFirst({ where: { id: ids.eventB } }),
    );

    expect(found).toBeNull();
  });

  it('returns nothing, not everything, when no tenant context is set', async () => {
    const events = await app.event.findMany({ where: { slug: { startsWith: tag } } });

    expect(events).toEqual([]);
  });

  it('does not leak context from one transaction to the next on a reused connection', async () => {
    await asTenant(ids.orgA, (tx) => tx.event.findMany());
    const after = await app.event.findMany({ where: { slug: { startsWith: tag } } });

    expect(after).toEqual([]);
  });

  it('refuses to write a row into another tenant', async () => {
    await expect(
      asTenant(ids.orgA, (tx) =>
        tx.event.create({
          data: {
            organizationId: ids.orgB,
            createdByUserId: ids.user,
            slug: `${tag}-forged`,
            name: 'forged',
            timeZone: 'UTC',
            startsAt: new Date('2026-06-01T09:00:00Z'),
            endsAt: new Date('2026-06-01T17:00:00Z'),
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("cannot update or delete another tenant's event", async () => {
    const updated = await asTenant(ids.orgA, (tx) =>
      tx.event.updateMany({ where: { id: ids.eventB }, data: { name: 'hijacked' } }),
    );
    const deleted = await asTenant(ids.orgA, (tx) =>
      tx.event.deleteMany({ where: { id: ids.eventB } }),
    );
    const still = await owner.event.findUnique({ where: { id: ids.eventB } });

    expect(updated.count).toBe(0);
    expect(deleted.count).toBe(0);
    expect(still?.name).toBe(`${tag}-event-b`);
  });

  it('isolates child tables that carry no organization_id of their own', async () => {
    const modules = await asTenant(ids.orgA, (tx) =>
      tx.eventModule.findMany({ where: { eventId: { in: [ids.eventA, ids.eventB] } } }),
    );

    expect(modules.every((m) => m.eventId === ids.eventA)).toBe(true);
    expect(modules).toHaveLength(1);
  });

  it("treats organisation identity as public but never lets one tenant change another's", async () => {
    // The workspace name and slug are public by design (branded public pages), so they are
    // readable. Writes are still bound to the caller's own organisation.
    const readable = await asTenant(ids.orgA, (tx) =>
      tx.organization.findMany({ where: { slug: { startsWith: tag } } }),
    );
    const renamed = await asTenant(ids.orgA, (tx) =>
      tx.organization.updateMany({ where: { id: ids.orgB }, data: { name: 'hijacked' } }),
    );
    const stillNamed = await owner.organization.findUnique({ where: { id: ids.orgB } });

    expect(readable.map((o) => o.id).sort()).toEqual([ids.orgA, ids.orgB].sort());
    expect(renamed.count).toBe(0);
    expect(stillNamed?.name).toBe('Org b');
  });

  it('has row-level security forced, with a policy, on every table that carries organization_id', async () => {
    // A structural guard: a table added later without RLS fails here instead of leaking.
    const tables = await owner.$queryRaw<{ relname: string; rls: boolean; forced: boolean; policies: bigint }[]>`
      SELECT c.relname,
             c.relrowsecurity AS rls,
             c.relforcerowsecurity AS forced,
             (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = 'public') AS policies
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind = 'r'
        AND EXISTS (
          SELECT 1 FROM information_schema.columns col
          WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'organization_id')`;

    expect(tables.length).toBeGreaterThanOrEqual(15);
    const unprotected = tables
      .filter((t) => !t.rls || !t.forced || Number(t.policies) === 0)
      .map((t) => t.relname);
    expect(unprotected).toEqual([]);
  });

  it('shows public events (published, public) but never drafts, to a caller with no tenant', async () => {
    await owner.event.update({ where: { id: ids.eventA }, data: { status: 'PUBLISHED', visibility: 'PUBLIC' } });
    const visible = await app.event.findMany({ where: { slug: { startsWith: tag } } });

    expect(visible.map((e) => e.id)).toEqual([ids.eventA]);
  });

  it('lets the platform scope read across tenants only when that scope is set', async () => {
    const without = await app.registration.findMany({ take: 1 });
    expect(without).toEqual([]);

    const all = await app.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
      return tx.event.findMany({ where: { slug: { startsWith: tag } } });
    });
    expect(all.map((e) => e.id).sort()).toEqual([ids.eventA, ids.eventB].sort());
  });
});
