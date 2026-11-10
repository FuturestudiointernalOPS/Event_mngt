# WP-09 — Participant categories and registration forms

**Wave** 2 · **Parallel-safe** yes
**Owns** `apps/api/src/modules/registration-forms/**`
**Depends on** WP-01, WP-05

## Goal

An event can define the categories a person registers under and the questions that form
asks, so the same registration engine serves every customer without per-customer code.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `GET /workspaces/:slug/events/:eventId/categories` | `registration:read` | categories, inactive ones included |
| `POST /workspaces/:slug/events/:eventId/categories` | `registration:manage` | create a category |
| `PATCH /workspaces/:slug/events/:eventId/categories/:categoryId` | `registration:manage` | rename, recapacity, reorder, deactivate |
| `GET /workspaces/:slug/events/:eventId/registration-form` | `registration:read` | the current form with its fields |
| `PUT /workspaces/:slug/events/:eventId/registration-form` | `registration:manage` | replace the form and its fields |
| `GET /public/events/:eventSlug/registration-form` | public | categories, fields, consent documents, window |

The event must be located through its public slug for the public route; nothing in the
public projection may contain an internal id that is not already public.

## Rules

- Categories are **event-scoped**. The same key in two events is two unrelated rows, and
  a category in event A can never classify a registration in event B.
- `key` is stable and unique per event once created; the label may change.
- Deactivating a category keeps every existing registration; it only removes the option
  from the public form. A registration cannot be moved to an inactive category.
- A form is one row per event with an increasing `version`. Saving replaces the field set
  atomically and bumps the version; answers already captured keep their `fieldKey`.
- Field keys are unique within the form. `SELECT` and `MULTI_SELECT` require options;
  other types must not carry them. Required/optional is per field.
- The form and categories are only available publicly when the event is published and its
  `registration` module is enabled. A private, draft or cancelled event is `404`.
- Every write runs inside the tenant transaction with an explicit `organizationId`
  predicate; every read of another tenant's event is `not_found`.

## Acceptance (each becomes a test)

1. Two events in one organisation hold independent categories with the same key.
2. A category from another organisation cannot be addressed by id.
3. Deactivating a category leaves its registrations intact and hides it publicly.
4. Saving a form with a duplicate field key is refused.
5. A select field without options is refused; a text field carrying options is refused.
6. Saving bumps the version and replaces fields without leaving orphans.
7. The public projection is `404` when registration is not enabled or the event is not
   published, and contains no internal ids.

## Integration requests to the pre-flight

- Schema: `ParticipantCategory`, `RegistrationForm`, `RegistrationField` (frozen).
- Contracts: `contracts/registration-forms.ts`.
- Register `RegistrationFormsModule`; catalogue its routes.

## Out of scope

Conditional field logic, per-category forms, translations of field labels, and answer
storage (WP-10).

## Handover

- `categories.*` and `registration-form.*` inside `modules/registration-forms/`.
- Public projection composed with `ConsentService` (WP-11) and the event's module settings.
- Risk: form versions are monotonic but there is no published-form history endpoint yet;
  answers survive field edits through the frozen `fieldKey`, which is the invariant that
  matters for wave 3 reporting.
