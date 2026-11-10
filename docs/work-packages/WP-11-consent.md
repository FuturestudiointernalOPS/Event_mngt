# WP-11 — Consent records

**Wave** 2 · **Parallel-safe** yes
**Owns** `apps/api/src/modules/consent/**`
**Depends on** WP-01

## Goal

An event states exactly which consents it asks for, with the wording that was accepted,
and every acceptance is recorded once and never rewritten.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `GET /workspaces/:slug/events/:eventId/consent-documents` | `registration:read` | documents with every version |
| `POST /workspaces/:slug/events/:eventId/consent-documents` | `registration:manage` | add a version for a key |

Consent records themselves are written by registration submission (WP-10), through the
exported service method. They have no write route of their own: a record is evidence, not
an editable resource.

## Rules

- A document is identified by `(event, key, version)`. Posting the same key again creates
  the next version; the previous versions stay readable and keep their body.
- Only the highest **published** version of a key is required at registration. An
  unpublished draft is invisible to the public form.
- A consent record snapshots `key`, `version` and `acceptedAt`, so later wording changes
  cannot alter what the participant agreed to.
- Records are append-only: no update or delete route exists, and the service exposes none.
- Consent is per event. A document key in event A says nothing about event B.
- Every write runs in the tenant transaction with an `organizationId` predicate; another
  tenant's document id is `not_found`.
- The module setting `requiresConsent` decides whether the browser is asked; the API
  enforces it on submission (WP-10), so a crafted request cannot skip consent.

## Acceptance (each becomes a test)

1. Posting a new version keeps the old body readable and increments the version.
2. Only the latest published version is in the public requirement list.
3. A draft version is not required publicly.
4. A record written for version 2 still reports version 2 after a version 3 is published.
5. Another tenant's document id is not found.
6. No service method updates or deletes a record.

## Integration requests to the pre-flight

- Schema: `ConsentDocument`, `ConsentRecord` (frozen).
- Contracts: `contracts/consent.ts`.
- Register `ConsentModule`, export `ConsentService`; catalogue its routes.

## Out of scope

Legal wording (a product decision, `docs/11` D2), withdrawal flows, and consent PDFs.

## Handover

- `consent.*` inside `modules/consent/`; `ConsentService.listRequirements(eventId)` is the
  single read the public form and registration submission both use.
- Risk: retention and deletion of consent records remain governed by `docs/11` D2; nothing
  here deletes them.
