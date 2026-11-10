# WP-18 — Aggregates and dashboards

**Wave** 4 · **Parallel-safe** yes
**Owns** `apps/api/src/modules/reports/**` (aggregate slice)
**Depends on** WP-10

## Goal

An authorised staff member can see the state of one event, the whole organisation, and
how editions compare, without exporting personal data.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `GET /workspaces/:slug/events/:eventId/reports/summary` | `report:read` | registrations by status/source/category, recent volume, participants, showcase, badges and a 30-day timeline |
| `GET /workspaces/:slug/reports/summary` | `report:read` | organisation totals plus one row per event |
| `GET /workspaces/:slug/events/:eventId/reports/editions` | `report:read` | the root event and its direct editions with the same breakdowns |

## Rules

- Every query carries the `organizationId` predicate; an event id from another tenant is
  `404`.
- The approval rate is approved ÷ (approved + rejected), and is `null` while nothing has
  been decided. A fresh event is not 0 %.
- The timeline is the last 30 UTC calendar days with empty days present. A chart must not
  silently drop a day.
- The edition comparison resolves to the root whichever id the caller supplies, so the
  screen does not depend on which event was opened.
- Counts come from grouped queries; the daily timeline uses one parameterised
  `date_trunc` query because Prisma cannot group by that expression.
- Aggregate responses may carry internal ids: the route requires `report:read`. Public
  figures are WP-20's concern.

## Acceptance (each becomes a test)

1. Status, source, category and moderation counts fill every key with zero when absent.
2. The approval rate is `null` before any decision and correct afterwards.
3. The timeline contains exactly 30 points, including empty days, in UTC.
4. Organisation totals sum the per-event rows and count published events correctly.
5. Edition entries keep the repository order and include the root.
6. Another tenant's event id is not found.

## Integration requests to the pre-flight

- Schema: none (reads wave 2 tables).
- Contracts: `contracts/reports.ts` (summary and edition shapes).
- Register `ReportsModule`; catalogue its routes.

## Out of scope

Caching, materialised views, check-in/meeting metrics (wave 3 tables), and report
scheduling. Those extend the same service without changing the contract.

## Handover

- `modules/reports/` is split by responsibility: event queries, portfolio/edition
  queries, pure shaping, and the export slice (WP-19).
- Risk: the daily timeline is computed in the database but rendered in UTC; an event whose
  audience spans time zones sees UTC days. That is documented in the contract.
