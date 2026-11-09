# WP-01 — Tenant bootstrap and RLS activation

**Wave** 0 · **Parallel-safe** no (blocks every package that touches tenant data)
**Owns** `apps/api/src/database/**`, `apps/api/src/common/guards/**`,
`apps/api/prisma/policies/**`, `apps/api/src/modules/permissions/permissions.service.ts`

## Goal

Tenant routes keep working with row-level security **on**, and the API connects as a
non-owner role so the policies actually apply.

## Why it blocks everything

Today the membership lookup runs before tenant context exists:

1. the route guard asks the permissions service to resolve the workspace from the slug;
2. that query reads `organization_members` and `organization_roles` with no transaction and
   no `set_config`;
3. the tenant context is created afterwards, by the interceptor.

With the existing policies enabled, step 2 returns zero rows, because the policy compares
against an unset organisation variable. Enabling RLS before fixing this ordering turns every
tenant route into a 404 or a 403.

## Required design

A **user-scoped bootstrap transaction**, used only to answer "which organisation does this
person belong to":

```ts
// shape, not final code
this.prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
  // membership + role + permission keys, filtered by that user
});
```

Policies must allow exactly that and nothing more:

| Table | Bootstrap access |
| --- | --- |
| `organization_members` | rows where `user_id = current_setting('app.current_user_id', true)` |
| `organizations` | rows reachable through a membership of that user |
| `organization_roles` | roles of organisations reachable that way |
| `role_permissions`, `permissions` | read-only catalogue and its links |
| everything else | unchanged: organisation must match the tenant variable |

Once the organisation is known, the request continues through the existing
`TenantTransactionService.withTenant`. No feature code sets configuration variables.

## What this must not open

The bootstrap scope is **user-scoped**, not tenant-free. A member of A must still be unable
to read A's data while claiming B, and a user with no membership must read nothing.

## Deliverables

- The bootstrap path in the database layer, used by the permissions service.
- Updated policy file; existing child-table parent-join policies (`event_modules`) preserved.
- The runtime role documented: the API connects as a non-owner (`platform_app`). The table
  owner bypasses RLS, so running as owner is a deployment defect.
- A short note in `docs/03` describing the bootstrap scope and its limits.

## Acceptance (each one becomes a test)

1. With RLS enabled, sign-in then a workspace route still succeeds for a real member.
2. A session with no tenant context reads zero rows from every tenant table.
3. Tenant A context reads only A rows, including through `event_modules`.
4. Two concurrent requests for different tenants do not leak context through the pool.
5. A user with no membership gets 403, and cannot distinguish a foreign workspace from a
   non-existent one.
6. No query outside the database layer issues `set_config`.

## Integration requests to the pre-flight

- Migration or script that creates the non-owner role and applies the policy file.
- Seed: a second organisation with one member, used by the isolation suite.

## Out of scope

Invitations, audit events, new endpoints.
