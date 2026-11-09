# 03 — Tenant isolation and RLS

Isolation is enforced in two independent layers. A defect in one must not become a data
breach.

## Layer 1 — API authorisation

1. `JwtAuthGuard` verifies the access token and attaches `request.user`.
2. `TenantAccessGuard` resolves the workspace from the route (`:slug`), the verified host,
   or an explicit `X-Workspace-Slug` header — **never** from a body or query
   `organizationId`.
3. It loads the membership for `(organizationId, userId)` and the permission set implied
   by the member's role.
4. It attaches `request.tenant = { organizationId, memberId, permissions }`.
5. `PermissionsGuard` compares `@RequirePermissions(...)` metadata against that set.
6. `TenantContextInterceptor` opens an `AsyncLocalStorage` scope for the handler.

A missing or invalid workspace yields `404` for public routes and `403` for authenticated
tenant routes (never leakage of existence across tenants).

## Layer 2 — PostgreSQL row-level security

### Roles

| Role | Used by | Properties |
| --- | --- | --- |
| `platform_owner` | migrations only | owns tables, bypasses RLS |
| `platform_app` | API runtime | `NOLOGIN`-safe non-owner, RLS applies, least privilege |
| `platform_migrator` | CI migrations | DDL rights, not used by the API |

The API connects as `platform_app`. This is not optional: `FORCE ROW LEVEL SECURITY` makes
policies apply to the table owner, but **Supabase grants `BYPASSRLS` to its `postgres`
role**, and a bypassing role ignores every policy regardless of `FORCE`. Running the API as
`postgres` therefore leaves the second layer switched off while looking enabled. Create the
role with `npm run db:roles`.

Two connection strings are used:

| Variable | Role | Used for |
| --- | --- | --- |
| `DATABASE_URL` | owner | Prisma CLI: migrations, generate, seed |
| `APP_DATABASE_URL` | `platform_app` | the running API |

On the Supabase pooler the username must be `<role>.<project-ref>`; a bare role name is
rejected with "no tenant identifier provided".

### Session variables

Within a transaction only:

```sql
SELECT set_config('app.current_organization_id', $1, true);
SELECT set_config('app.current_user_id', $2, true);
```

The third argument `true` means transaction-local. A pooled connection therefore returns
to an empty context on commit or rollback. `TenantTransactionService` is the only place
that sets these; no feature code issues `SET` statements.

### The three scopes

| Scope | Function | Who | What it can read |
| --- | --- | --- | --- |
| Tenant | `withTenant` | an authenticated member | one organisation's rows |
| Bootstrap | `withUserScope` | sign-in, and tenant resolution | this account's own membership, its organisations and their roles |
| Public | `withPublicOrganization` | anonymous visitor | one organisation's settings and branding, after a public identifier resolved it |

Bootstrap exists because membership resolution happens **before** a tenant is known. With
only tenant policies, that query returns nothing and every tenant route fails. The bootstrap
policies are `SELECT`-only and keyed on `app.current_user_id`.

### What is public

Two policies intentionally expose rows without any context, because that is what a public
page is:

- `organizations` where `status = 'ACTIVE'` — the workspace identity (id, slug, name).
- `events` that are `PUBLIC` or `UNLISTED` and not draft, cancelled or archived.

Everything else stays invisible. Settings and branding are **not** public: they are read
inside the public organisation scope once the slug or the published event has resolved the
organisation.

### Policy shape

```sql
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;

CREATE POLICY events_tenant_isolation ON events
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
```

Rules:

- `ENABLE` **and** `FORCE` so the owner cannot quietly bypass.
- The `nullif(..., '')::uuid` cast keeps the policy safe when no context is set: the
  comparison yields `NULL`, the row is filtered out, and reads return nothing rather than
  everything.
- `USING` blocks reads; `WITH CHECK` blocks writes. Both are required for write paths.
- Child tables either carry `organization_id` or a policy that joins to a tenant-scoped
  parent (`EXISTS (SELECT 1 FROM events e WHERE e.id = event_modules.event_id AND …)`).
  Carrying the column directly is preferred: policies stay index-friendly and cheap.

Reference file: `apps/api/prisma/policies/tenant-rls.sql`. It is executed as part of the
migration that creates each table and must be updated in the same change.

## Defence in depth inside the code

Even with RLS on, repositories always add explicit predicates:

```ts
// wrong — relies solely on RLS
this.prisma.event.findMany();

// right — RLS is the second layer, not the only one
tx.event.findMany({ where: { organizationId: ctx.organizationId } });
```

Prisma does not model RLS. The rule is: **any query against a tenant-owned table must be
executed through `TenantTransactionService.withTenant` and include an explicit
`organizationId` predicate.**

## Background jobs and public endpoints

- **Jobs** carry `organizationId` in the payload and re-enter `withTenant` inside the
  worker. A job without tenant context fails loudly rather than running unscoped.
- **Public endpoints** (`/public/events/:slug/...`) do not use a user session. They run in
  a read context scoped to the resolved organisation and select only approved fields via
  dedicated projections — no `SELECT *` into a public response.
- **Platform admin endpoints** legitimately cross tenants. They are the only code paths
  allowed to bypass tenant predicates, they are audited, and they are covered by
  permissions that no organisation role holds.

## The threat model, condensed

| Threat | Control |
| --- | --- |
| Client sends another tenant's `organizationId` | Ignored; context derived from membership |
| Stale tenant context on a pooled connection | `set_config(..., true)` inside `$transaction`; verified by test |
| Missing `WHERE organization_id` in a new query | RLS policy returns zero rows; isolation tests fail loudly first |
| API running as table owner | Deployment check: connection role is `platform_app` |
| Cross-tenant data in a public projection | Dedicated public DTOs, no wildcard selects |
| Cross-tenant data in a cached page | Cache key includes organisation slug; public payloads aggregated |
| Role escalation by assigning a role from another tenant | Role lookup constrained to `organizationId`; FK plus service check |

## Tests that must exist (Blocking)

1. Organisation A cannot read, list, update, delete B's records — for every tenant table.
2. A nested relation cannot be traversed across tenants (e.g. event → modules → settings).
3. A request with no tenant context returns empty, not everything.
4. Two concurrent requests for different tenants do not leak context through the pool.
5. Background jobs executed for tenant A never touch tenant B.
6. A user removed from a workspace immediately loses access on the next request.
7. A crafted `organizationId` in a body or query changes nothing.

## Manual verification before any release

```sql
-- expect 0 rows for a session with no tenant context
SELECT count(*) FROM events;

-- expect only tenant A rows
SELECT set_config('app.current_organization_id', '<tenant-a-uuid>', true);
SELECT count(*) FROM events;
```

Run against the application role, not the owner.
