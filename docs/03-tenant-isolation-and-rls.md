# 03 — Tenant isolation and RLS

Isolation is enforced in two independent layers. A defect in one must not become a data
breach.

## Layer 1 — API authorisation

1. `JwtAuthGuard` verifies the access token and attaches `request.user`.
2. `TenantAccessGuard` resolves the workspace from the route (`:slug`), the verified host,
   or an explicit `X-Workspace-Slug` header — **never** from a body or query
   `organizationId`.
3. It loads the membership, the role's capabilities, the member's direct capability
   grants and the organisation's entitlements, then computes the effective set.
4. It attaches `request.tenant = { organizationId, memberId, capabilities, … }`.
5. `CapabilityGuard` compares `@RequireCapability(...)` metadata against that set.
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
SELECT set_config('app.platform_admin', 'true', true);
SELECT set_config('app.platform_support', 'true', true);
```

The third argument `true` means transaction-local. A pooled connection therefore returns
to an empty context on commit or rollback. `TenantTransactionService` is the only place
that sets these; no feature code issues `SET` statements. `app.platform_admin` is set
only by `withPlatformAdmin`, after the JWT guard has verified the platform administrator
claim, and only the organisation identity, organisation entitlement and capability
tables opt into it. `app.platform_support` is a narrower, additional flag set only by
`withPlatformSupport`; it exposes read-only aggregate counts from the team, event and
registration tables for the support view.

### The scopes

| Scope | Function | Who | What it can do |
| --- | --- | --- | --- |
| Tenant | `withTenant` | an authenticated member | read and write one organisation's rows |
| Bootstrap | `withUserScope` | sign-in, and tenant resolution | read this account's own membership, its organisations and their roles |
| Onboarding | `withOrganizationProvisioning` | a signed-in account creating its first workspace | create one server-generated organisation, its defaults, roles, entitlements and first membership |
| Platform administration | `withPlatformAdmin` | a verified platform administrator | list organisations, change organisation status and manage capability entitlements |
| Platform support | `withPlatformSupport` | a verified platform administrator | read organisation identity plus aggregate member, event and registration counts; every detail read is audited |
| Public read | `withOrganizationScope` | anonymous visitor | read one organisation's settings and branding, and approved showcase rows, after a public identifier resolved it |
| Public submission | `withOrganizationScope` | anonymous registrant | insert registration-owned rows for the organisation resolved from a published event slug |

Bootstrap exists because membership resolution happens **before** a tenant is known. With
only tenant policies, that query returns nothing and every tenant route fails. The bootstrap
policies are `SELECT`-only and keyed on `app.current_user_id`.

Public submission reuses the organisation scope but is the only anonymous path that
**writes**. The organisation comes from the published event slug, never from the request;
only registration-owned tables are written; the route is rate-limited by IP and accepts an
`Idempotency-Key` so a retry returns the first receipt.

Two further pre-tenant policies exist for single-purpose flows:

- an audit row with no organisation may be written and read back by the account it is
  attributed to (sign-in has no tenant);
- an invitation may be read and consumed only by the account whose email it names.

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
  dedicated projections — no `SELECT *` into a public response. The single exception is
  registration submission, which writes registration-owned rows inside the same
  organisation scope; the organisation is resolved server-side from the published event.
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
| A member crafts another organisation's capability assignment | Effective set is computed from the verified membership; capability rows carry `organization_id` RLS |
| An organisation entitlement is revoked | The intersection is recomputed on every request; member grants remain stored but ineffective |

## Tests that must exist (Blocking)

Implemented in `apps/api/test/isolation/` and run with `npm run test:isolation`. The suite
creates its own fixtures, runs as the runtime role, and is deliberately outside `npm test`
because it needs a database.

1. Organisation A cannot read, list, update, delete B's records — for every tenant table.
2. A nested relation cannot be traversed across tenants (e.g. event → modules → settings).
3. A request with no tenant context returns empty, not everything.
4. Two concurrent requests for different tenants do not leak context through the pool.
5. Background jobs executed for tenant A never touch tenant B.
6. A user removed from a workspace immediately loses access on the next request.
7. A crafted `organizationId` in a body or query changes nothing.
8. Organisation and member capability rows are invisible across tenants, and revoking
   an entitlement blocks the affected action on the next request.

## Manual verification before any release

```sql
-- expect 0 rows for a session with no tenant context
SELECT count(*) FROM events;

-- expect only tenant A rows
SELECT set_config('app.current_organization_id', '<tenant-a-uuid>', true);
SELECT count(*) FROM events;
```

Run against the application role, not the owner.


## Update: pre-tenant reads and the Super Admin scope

Row-level security is **enforced end to end** and the API works with it on. Three kinds of
read happen before a tenant is known, so they have their own narrow, SELECT-only policies
(see `apps/api/prisma/policies/tenant-rls.sql`):

- **Public identity**: an active organisation's name/slug, its branding and settings, and
  *published* public/unlisted events (`*_public_read`). Needed for tenant shells and public
  pages.
- **Own memberships**: `app.current_user_id` lets a signed-in user read their own
  membership and role rows (for `/auth/me` and membership resolution).
- **Platform administration**: `app.platform_admin = 'true'`, set only by
  `TenantTransactionService.withPlatformAdmin()` after the caller's flag was re-read from
  the database, grants cross-tenant reads of organisation identity and organisation
  status changes. A second flag, `app.platform_support`, is set only by
  `withPlatformSupport()` and exposes read-only aggregate counts for the support view.
  Neither flag widens access to individual participant or member rows.

Writes are never widened: they stay bound to the caller's own `app.current_organization_id`.
The participant portal and public registration enter an organisation's scope with
`withOrganization()`, where the organisation id is either derived from a public event slug
or proven by a secret credential, never trusted from a request.

The isolation spec enforces the property structurally: any table with an `organization_id`
column must have RLS forced and at least one policy.
