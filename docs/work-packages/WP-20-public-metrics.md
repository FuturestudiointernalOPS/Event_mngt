# WP-20 — Public metrics

**Wave** 4 · **Parallel-safe** yes
**Owns** `apps/api/src/modules/analytics/**`
**Depends on** WP-18

## Goal

A public event page can show credible participation figures without exposing, or making
recoverable, any individual's data.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `GET /public/events/:eventSlug/metrics` | public | anonymised totals, category distribution and showcase counts |

## Rules

- The event is resolved from its public slug under the published-event policy; private,
  draft and cancelled events are `404`.
- The `reporting` module must be enabled for the event; otherwise the route is `404`,
  exactly like a missing event.
- Only approved registrations, approved-and-public profiles and approved-and-public
  innovations are counted. Contact fields are never selected.
- A count below five is withheld (`null`). Every published count is rounded down to the
  nearest five. The response carries a `disclosure` block so the client can explain the
  method.
- Withholding and rounding are deliberately both applied: a reader cannot subtract
  buckets from a total to recover an exact figure.

## Acceptance (each becomes a test)

1. 0–4 is withheld; 5 is published.
2. 19 becomes 15 and 101 becomes 100.
3. A category with a small count is present with `null`, not removed silently.
4. The disclosure block matches the constants the rules use.
5. The exact raw counts do not appear in the serialised response.
6. A disabled reporting module or a private event is `404`.

## Integration requests to the pre-flight

- Contracts: `contracts/analytics.ts` with the thresholds as exported constants.
- Register `AnalyticsModule`; catalogue its public route.

## Out of scope

Platform-wide metrics, historical snapshots, charts data beyond the contract, and any
breakdown that could identify a person (country × category cells, for example).

## Handover

- `public-metrics.rules.ts` owns suppression and rounding; the repository returns raw
  counts only.
- Risk: a public page can infer change over time by polling. That is acceptable for
  event-scale figures; a cache with a short TTL is the next step if abuse appears.
