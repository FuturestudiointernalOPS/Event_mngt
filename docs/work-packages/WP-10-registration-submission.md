# WP-10 — Registration submission

**Wave** 2 · **Parallel-safe** yes
**Owns** `apps/api/src/modules/registrations/**`
**Depends on** WP-09, WP-11

## Goal

A person registers for a published event through the public form, their answers and
consents are stored against that event only, and the same submission replayed twice does
not create two registrations.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `POST /public/events/:eventSlug/registrations` | public | submit; returns a receipt |
| `GET /workspaces/:slug/events/:eventId/registrations` | `registration:read` | paginated, filterable list |
| `GET /workspaces/:slug/events/:eventId/registrations/:registrationId` | `registration:read` | one registration with answers |

The public route is `@Idempotent()` and rate-limited by IP, because it is the only
unauthenticated write in the product.

## Rules

- The event is resolved from its public slug, never from a body field. The organisation
  comes from the event row. A private, draft, cancelled or archived event is `404`.
- The `registration` module must be enabled; otherwise `404` (not enabled) for the public
  route.
- The registration window is enforced: before `registrationOpensAt` or after
  `registrationClosesAt` the answer is `422 registration_closed`.
- `Person` is organisation-scoped and matched by lowercased email inside that organisation
  (`docs/11` D4). It is never matched across organisations.
- Answers are validated against the current form: unknown keys are refused, required
  fields must be present and non-empty, single-select values must be one of the options,
  multi-select values must all be options. The validation is a pure function with tests.
- Required consents are checked against the latest **published** document per key, and the
  accepted `(key, version)` pair must match that document. The record snapshots it.
- Duplicate detection uses the module setting `duplicatePolicy`:
  `block` refuses with `409 duplicate_registration`; `warn` stores the registration and
  returns `duplicate: true` in the receipt.
- `approvalMode: automatic` approves immediately and issues a badge; `manual` leaves the
  registration `PENDING` for WP-12.
- The receipt contains the per-event `reference`, the status and flags — never internal
  ids, answers or other participants' data.
- Every staff read carries an explicit `organizationId` and `eventId` predicate; another
  tenant's registration is `not_found`.

## Acceptance (each becomes a test)

1. A valid submission creates a person, a registration, its answers and its consent
   records, all under the event's organisation.
2. The same email registering for a second event in the same organisation reuses the
   person row and creates a second registration.
3. The same email in another organisation creates an unrelated person row.
4. A missing required answer, a wrong select option and an unknown field key are refused.
5. Submission outside the window is `422 registration_closed`.
6. `duplicatePolicy: block` refuses the second submission; `warn` accepts it and reports
   the duplicate.
7. Replaying the same `Idempotency-Key` returns the first receipt and creates no second row.
8. `approvalMode: automatic` yields `APPROVED` and a badge; `manual` yields `PENDING`.
9. A registration id from another organisation is not found.

## Integration requests to the pre-flight

- Schema: `Person`, `Registration`, `RegistrationAnswer` (frozen).
- Contracts: `contracts/registrations.ts`.
- Register `RegistrationsModule`; catalogue its routes.

## Out of scope

Approval and rejection (WP-12), badge rendering (WP-13), profiles (WP-14) and payment.

## Handover

- Submission, staff list and detail in `modules/registrations/`; the state machine and the
  decision routes live beside them (WP-12).
- The public write runs in `withOrganizationScope`, resolved from the published event slug
  — the only public path that writes, documented in `docs/03`.
- Risk: no captcha; the IP budget and idempotency are the only abuse controls in wave 2.
