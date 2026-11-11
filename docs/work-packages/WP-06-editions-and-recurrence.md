# WP-06 — Editions and recurrence

**Wave** 1 · **Parallel-safe** yes, but you own the whole `events` module
**Owns** `apps/api/src/modules/events/**`
**Depends on** WP-01

## Goal

A series of events can be modelled as a parent with dated editions, so "Innovation Village
2025" and "2026" share a container without sharing registrations.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `GET /workspaces/:slug/events/:eventId/editions` | `event:read` | list editions, newest first |
| `POST /workspaces/:slug/events/:eventId/editions` | `event:manage` | create an edition |
| `GET /workspaces/:slug/events/:eventId/editions/:editionId` | `event:read` | one edition |

The self-relation already exists (`parentEventId`, `editions`). Use it; do not add tables.

## Rules

- **Depth is one.** A parent may have editions; an edition may not itself have editions.
  Creating an edition of an edition is refused with `invalid_reference`.
- The parent must belong to the same organisation. A parent id from another tenant is
  reported as not found, never as a permissions error.
- An edition carries its own slug, dates, venue and visibility. Nothing is copied implicitly:
  the caller states every field. Silence must never mean "inherit".
- Slug uniqueness stays per organisation, as it already is for events.
- Publishing rules are unchanged: the existing lifecycle rules apply to editions too, and
  publishing is still refused for cancelled or archived events.
- Keep the module inside the 300-line rule. The module is already split into service,
  repository, mapper, query, lifecycle and projection; add to those, do not merge them.

## Acceptance (each becomes a test)

1. Create an edition under a parent: both are listed, the parent reports the edition count.
2. An edition of an edition is refused.
3. A parent id from another organisation is not found.
4. An edition with a duplicate slug in the same organisation is refused; the same slug in a
   different organisation is allowed.
5. Nothing is inherited: an edition created without a venue has no venue.
6. Publishing an edition follows the same transition rules as any event.

## Integration requests to the pre-flight

None. The relation, the routes' controller and the module registration already exist.

## Out of scope

Recurring schedules (RRULE), automatic edition generation, and copying content between
editions.

## Handover

- Implemented as `editions.controller.ts`, `editions.service.ts`, `editions.repository.ts`
  and `editions.rules.ts` inside `modules/events/`.
- Routes: `GET/POST /workspaces/:slug/events/:eventId/editions` and
  `GET .../editions/:editionId`. Depth is one, slugs stay unique per organisation, and every
  query carries both the organisation and parent predicates.
- The general event-create route now applies the same depth rule when it receives
  `parentEventId`, so the two creation paths cannot disagree.
- Publishing an edition reuses the existing event publish route and lifecycle rules.
- Risk: the general event list still includes editions; that is intentional (acceptance 1),
  but a future “series only” filter will need an explicit query parameter.
