# WP-16 — Offline check-in sync

**Wave** 3 · **Parallel-safe** no (extends the WP-15 module)
**Owns** `apps/api/src/modules/check-in/**` (sync slice)
**Depends on** WP-15, WP-08 (idempotency and rate limits)

## Prerequisites — waves 1–2 are not in the tree

WP-15 must exist first: this package adds a slice to the same module and reuses its scan
rules, repository and tenant boundary. WP-08 supplies the `Idempotency-Key` handling and the
check-in rate-limit bucket. Neither is implemented in this repository today (see WP-15's
prerequisite table). Do not start this package by creating a second check-in module.

## Goal

A staff device that scanned badges while offline can upload its queue when connectivity
returns, and the server produces exactly the attendance the online path would have produced —
no duplicates, no lost scans, and a per-scan outcome the device can reconcile against.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `POST /workspaces/:slug/events/:eventId/check-ins/sync` | `checkin:operate` | accept a batch of scans and return one outcome per scan |

Request body: `{ deviceId?, scans: [{ scanId, badgeToken, scannedAt }] }`, capped at 500
scans per request. `scanId` is a UUID generated on the device before the scan is written to
IndexedDB; it is stable across retries.

Response `data`: `{ results: [{ scanId, status, checkInId?, code?, participant? }] }` plus
counts for created, duplicate and rejected. `status` is `created`, `duplicate` or `rejected`.
The route returns 200 even when some scans are rejected: a partial batch is a business
outcome, not a request failure.

## Rules

- **Ordering is the device's, not the server's.** The batch is processed in ascending
  `scannedAt`, so the earliest scan of a registration wins the single attendance row and later
  scans report `duplicate`.
- **Idempotency is per scan, not per request.** `(event_id, scan_id)` is unique. Re-sending a
  batch creates nothing new and returns the same outcomes for the same scans. The
  `Idempotency-Key` header additionally short-circuits a byte-identical replay of the whole
  request.
- **One bad scan does not fail the batch.** An unknown, revoked or foreign token yields a
  rejected entry with a stable code; the remaining scans are still processed. The batch is
  not wrapped in a single all-or-nothing transaction; each accepted scan is committed.
- **A rejected scan is re-evaluated on replay**, because it stored nothing. This is
  deliberate: if a badge is fixed and the device retries, the scan can succeed. The device
  is expected to remove rejected entries from its queue after showing the reason.
- **Clock skew is bounded, not trusted blindly.** `scannedAt` is stored as recorded, but a
  timestamp in the future by more than the configured skew is replaced by the server receive
  time, and `receivedAt` is stored separately. The response never leaks another tenant's
  badge by timing or by error text.
- **Event and tenant predicates are explicit** on every read and write, exactly as in WP-15.
  The route's `eventId` is the only event the batch may touch; there is no per-scan event id.
- **The raw token is never stored or logged.** Only the hash lookup result is used.
- **Rate limits** apply to the sync route from the WP-08 bucket; exceeding the limit returns
  the documented `rate_limited` code.
- **Queue reconciliation is the client's job.** The server reports outcomes; it never asks
  the client to discard a scan it has recorded, because the device may have crashed before
  receiving the response.

## Schema this package needs (declared for the pre-flight)

WP-15 already declares `check_ins.scan_id`, `source`, `scanned_at`, `received_at` and the
`(event_id, scan_id)` unique constraint. This package adds no table. If WP-15 chose a
different shape, raise it before writing code rather than adding a parallel
`offline_scans` table.

## Acceptance (each becomes a test)

1. A batch of N valid scans creates N attendance rows and returns N `created` outcomes.
2. Replaying the same batch creates no new rows and returns the same outcomes.
3. A batch containing one unknown token processes the rest; the unknown scan is `rejected`
   with `not_found` and the accepted ones are persisted.
4. Two scans for the same registration in one batch (or across batches) produce one row; the
   later one is `duplicate`.
5. Scans arrive out of order: the earliest `scannedAt` becomes the attendance time and the
   rest report `duplicate`.
6. A scan already recorded online, then synced, reports `duplicate` and does not move the
   original timestamp.
7. A batch above the cap is refused with `validation_error`; nothing is written.
8. A token from another organisation is `rejected` with no information that distinguishes it
   from an unknown token.
9. The same `scanId` replayed with a different badge token does not overwrite the first
   attendance; it is reported as a duplicate of the stored scan.
10. A future `scannedAt` beyond the skew bound is stored as the receive time.

## Integration requests to the pre-flight

- Shared contracts: sync request, per-scan result, batch summary.
- API path for the sync route.
- WP-08's idempotency guard and check-in rate-limit bucket applied to this route.

## Out of scope

Server-push of the event dataset to the device, service-worker caching, conflict resolution
UI, and manual upload from a file. The frontend queue in
`apps/web/src/features/check-in/offline/scan-queue.ts` is the client half and is not owned by
this package.
