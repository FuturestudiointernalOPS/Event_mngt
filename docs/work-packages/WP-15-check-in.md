# WP-15 — Check-in and QR verification

**Wave** 3 · **Parallel-safe** yes
**Owns** `apps/api/src/modules/check-in/**`
**Depends on** WP-05 (module registry), WP-13 (badges)

## Prerequisites — waves 1 and 2 are not in the tree

This brief opens wave 3. It cannot be handed to a worker yet, and the worker must not
improvise around the gap:

| Needed | State in this repository |
| --- | --- |
| `event_modules` and module gating | table and registry exist; no module-registry service |
| `modules/badges/` and the `badges` table (WP-13) | absent |
| `registrations` / `people` projections (WP-10) | absent |
| Wave 1 and 2 briefs and code | not written / not implemented |

WP-15 consumes badges; it does not create them. If WP-13 has landed with a different
verification surface than the one stated below, **stop** and raise an integration request
instead of querying `badges` from this module.

## Goal

A member of staff scans a participant's badge and the platform records attendance exactly
once, online, with an explicit outcome for valid, revoked, foreign and duplicate scans.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `POST /workspaces/:slug/events/:eventId/check-ins` | `checkin:operate` | verify one scan and record attendance |
| `GET /workspaces/:slug/events/:eventId/check-ins` | `checkin:read` | attendance list, newest first, paginated |
| `GET /workspaces/:slug/events/:eventId/check-ins/summary` | `checkin:read` | counted attendance for the event |

The single-scan body carries the scanned value, an optional device-generated `scanId`, and
the device's `scannedAt`. The response returns the attendance record, the participant's
display name and category, and `duplicate: true` when the registration was already recorded.

The expected badge surface from WP-13, to be imported as a service (R10):

```ts
verifyForEvent(input: {
  organizationId: string;
  eventId: string;
  token: string;
}): Promise<{ badgeId: string; registrationId: string; status: 'ISSUED' | 'REVOKED' } | null>;
```

## Rules

- **The raw token is never stored.** The badge holds a hash; check-in hashes the scanned value
  and resolves within `(organizationId, eventId)`. A hash that matches nowhere is reported as
  `not_found`, never as a permission error.
- **One attendance per registration per event.** A repeat scan returns the existing row with
  `duplicate: true` and writes nothing. The module setting `duplicateWindowMinutes` decides
  whether the repeat is labelled an accidental double-scan or a re-entry; it never creates a
  second row.
- **Revoked badges are refused** with `badge_revoked` (422). Expiry is not modelled.
- **The event must be operational.** `CANCELLED`, `ARCHIVED` and `DRAFT` events refuse
  check-in with `event_not_operational`; completed events accept late scans.
- **The `checkin` module must be enabled for the event**, otherwise `module_not_enabled`.
  The dependency `registration` is enforced by the registry, not re-checked here.
- **Tenant scope comes from the guard.** Every read and write runs through `withTenant` and
  carries an explicit `organizationId` predicate, in addition to the event predicate.
- **Staff-facing projection only.** The lookup returns the name and category required to
  confirm the person in front of the scanner; it never returns email, phone, answers or
  consent data.
- **Audit.** A successful check-in records `checkin.recorded` through the audit service; a
  refused scan records nothing. The call site is an integration request until WP-03 is wired.
- The module is split so no file crosses 300 lines: controller, service, repository, mapper,
  a pure scan-rules file, and a spec beside each rule file.

## Schema this package needs (declared for the pre-flight)

A `check_ins` table that carries `organization_id` directly, plus `event_id` and
`registration_id`:

- `source` enum: `ONLINE`, `OFFLINE`, `MANUAL`;
- `scan_id` nullable (device-generated, unique per event when present);
- `scanned_at`, `received_at`, `checked_in_by_user_id`, `device_id` nullable;
- unique on `(event_id, registration_id)` — the attendance invariant;
- unique on `(event_id, scan_id)` — idempotent replays;
- index on `(organization_id, event_id, scanned_at)`.

The table needs a tenant policy in `prisma/policies/tenant-rls.sql` and a classification in
the policy coverage test. It also needs shared contracts and an API-path entry.

## Acceptance (each becomes a test)

1. A valid badge for the event records attendance once and returns the participant summary.
2. A token from another event or another organisation is reported as not found.
3. A second scan of the same registration returns the original row, `duplicate: true`, and
   leaves the row count unchanged.
4. A revoked badge is refused with `badge_revoked`.
5. Check-in against a cancelled or archived event is refused with `event_not_operational`.
6. An event without the `checkin` module enabled is refused with `module_not_enabled`.
7. A caller with `checkin:read` but not `checkin:operate` can list but not scan.
8. Listing is paginated and ordered by `scannedAt` descending.
9. No stored row or response contains the raw scanned value.
10. Every query carries both the organisation and event predicates; a foreign event id is
    not found.

## Integration requests to the pre-flight

- The `check_ins` model, its migration, its RLS policy and the policy-coverage entry.
- Shared contracts: scan request, attendance record, list query, summary.
- API paths for the three routes.
- `CheckInModule` registration in the composition root.
- Module gating: the `checkin` module definition already exists in the shared registry; only
  the API-side check is new and belongs to WP-05.
- Seed: one issued badge and one revoked badge for a demo event, used by the tests.

## Out of scope

Offline batch sync (WP-16), badge issuance (WP-13), QR rendering, manual lookup by name or
email beyond the attendance list, and attendance reports (WP-18).
