import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Keeps the policy file in step with the schema.
 *
 * A new tenant-owned model without a policy is an isolation hole that no other test
 * would notice, because the API still filters by organisation id. Every model must
 * therefore fall into exactly one category below: if someone adds a table and does not
 * classify it, this file fails.
 */

// Tests run from the API workspace directory, beside `prisma/`.
const SCHEMA = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');

const POLICIES = readFileSync(
  resolve(process.cwd(), 'prisma/policies/tenant-rls.sql'),
  'utf8',
);

interface SchemaModel {
  name: string;
  table: string;
  body: string;
}

function readModels(source: string): SchemaModel[] {
  return [...source.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(([, name, body]) => ({
    name,
    table: /@@map\("([^"]+)"\)/.exec(body)?.[1] ?? name,
    body,
  }));
}

/** Child tables without the column: scoped through a constrained parent. */
const CHILD_TENANT_TABLES: Array<{ table: string; parent: string }> = [
  { table: 'role_permissions', parent: 'organization_roles' },
  { table: 'event_modules', parent: 'events' },
];

/** Tables that carry no tenant rows, with the reason recorded in the policy file. */
const NOT_TENANT_OWNED = [
  'users',
  'user_sessions',
  'verification_tokens',
  'permissions',
  'rate_limit_counters',
];

/**
 * Tenant-owned rows with an optional organisation: an anonymous row belongs to no
 * tenant, a row with an organisation is isolated to it.
 */
const NULLABLE_TENANT_TABLES = ['idempotency_records'];

const models = readModels(SCHEMA);

const tenantTables = models
  .filter(
    (model) =>
      model.name === 'Organization' || /^\s+organizationId\s+String/m.test(model.body),
  )
  .map((model) => model.table);

const childTables = CHILD_TENANT_TABLES.map((entry) => entry.table);

const policyBlocks = [...POLICIES.matchAll(/CREATE POLICY (\w+) ON (\w+)([\s\S]*?);/g)].map(
  ([, policy, table, body]) => ({ policy, table, body }),
);

const created = policyBlocks.map(({ policy, table }) => ({ policy, table }));

const policyBody = (table: string, policy: string): string | undefined =>
  policyBlocks.find((block) => block.table === table && block.policy === policy)?.body;

const dropped = new Set(
  [...POLICIES.matchAll(/DROP POLICY IF EXISTS (\w+) ON \w+/g)].map(([, policy]) => policy),
);

describe('row-level security coverage', () => {
  it('classifies every model as tenant-owned, child-scoped, or deliberately unprotected', () => {
    const classified = new Set([
      ...tenantTables,
      ...childTables,
      ...NOT_TENANT_OWNED,
      ...NULLABLE_TENANT_TABLES,
    ]);

    const unclassified = models
      .map((model) => model.table)
      .filter((table) => !classified.has(table));

    expect(unclassified).toEqual([]);
  });

  it.each([...tenantTables, ...NULLABLE_TENANT_TABLES])('forces row-level security on %s', (table) => {
    expect(POLICIES).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    expect(POLICIES).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
  });

  it.each([...tenantTables, ...childTables, ...NULLABLE_TENANT_TABLES])(
    'defines the tenant policy for %s',
    (table) => {
      expect(created).toContainEqual({ policy: `${table}_tenant_isolation`, table });
    },
  );

  it.each(CHILD_TENANT_TABLES)('scopes $table through its parent $parent', ({ table, parent }) => {
    const body = policyBody(table, `${table}_tenant_isolation`);

    expect(body).toBeDefined();
    expect(body).toContain(`FROM ${parent}`);
  });

  it.each(NOT_TENANT_OWNED)('leaves the non-tenant table %s unprotected', (table) => {
    expect(POLICIES).not.toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  });

  it('is idempotent: every policy is dropped before it is created', () => {
    const missing = created.filter((entry) => !dropped.has(entry.policy));

    expect(missing).toEqual([]);
  });

  it('provides the bootstrap scope needed before tenant context exists', () => {
    const bootstrap = [
      'organization_members_user_bootstrap',
      'organizations_user_bootstrap',
      'organization_roles_user_bootstrap',
      'role_permissions_user_bootstrap',
    ];
    const names = created.map((entry) => entry.policy);

    for (const policy of bootstrap) {
      expect(names).toContain(policy);
    }
  });

  it('allows a signed-in user to record and read back an unscoped audit row', () => {
    // The read half is required: an INSERT ... RETURNING also evaluates SELECT.
    const names = created.map((entry) => entry.policy);

    expect(names).toEqual(
      expect.arrayContaining(['audit_logs_actor_insert', 'audit_logs_actor_read']),
    );
  });

  it('lets an invited person read and consume only their own invitation', () => {
    const names = created.map((entry) => entry.policy);

    expect(names).toContain('invitations_recipient_read');
    expect(names).toContain('invitations_recipient_consume');
  });

  it('only exposes public reads for active organisations and published events', () => {
    const publicPolicies = created.filter((entry) => entry.policy.endsWith('_public_read'));

    expect(publicPolicies.map((entry) => entry.table).sort()).toEqual([
      'events',
      'organizations',
    ]);
  });
});
