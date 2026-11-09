# WP-02 — Cross-tenant isolation suite

**Wave** 0 · **Parallel-safe** yes (authoring can start with WP-01; it passes once WP-01 lands)
**Owns** `apps/api/test/**`, `scripts/test-isolation.mjs`
**Depends on** WP-01

## Goal

The seven isolation guarantees in `docs/03` become executable, so a regression is caught by
a command instead of a review.

## Why it is separate from WP-01

WP-01 changes the mechanism; this package proves it. Keeping them apart means the proof is
written from the requirements, not from the implementation — and that the suite can be handed
to a fresh worker with no knowledge of how the bootstrap transaction works.

## Shape of the suite

- It needs a real database, so it is **not** part of `npm test`. `npm test` stays fast and
  database-free.
- It runs through a dedicated script (`npm run test:isolation`), against two seeded
  organisations, using the application role (not the owner).
- It is skipped with a clear message when no database is configured, so a fresh clone still
  runs the rest of the checks.

## Acceptance (each item is one test)

1. Organisation A cannot read, list, update or delete B's rows — for every tenant table.
2. A nested relation cannot be traversed across tenants (event → modules).
3. A query with no tenant context returns empty, never everything.
4. Two concurrent requests for different tenants do not leak context.
5. A background-style job scoped to A never touches B.
6. Removing a member revokes access on the very next request.
7. A crafted `organizationId` in a body or query changes nothing.

## Implementation notes

- The project's tests are written in TypeScript beside the code; this suite lives under
  `apps/api/test/` because it spans modules, which the API test include pattern already
  covers.
- Prefer HTTP through the application for cases 1, 3, 6 and 7: they are about what a client
  can do, not about which method was called.
- Cases 2 and 4 need direct database access to be meaningful.

## Integration requests to the pre-flight

- `npm run test:isolation` script at the root.
- Seed data: organisation A, organisation B, one member each, one event each.

## Out of scope

Performance, load, and any product behaviour. This suite only asserts separation.
