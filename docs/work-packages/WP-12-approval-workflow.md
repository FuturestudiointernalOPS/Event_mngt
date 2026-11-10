# WP-12 — Approval workflow

**Wave** 2 · **Parallel-safe** no — same folder as WP-10
**Owns** the approval slice of `apps/api/src/modules/registrations/**`
**Depends on** WP-10, WP-13 (badge issuance on approval)

## Goal

Staff move a registration from pending to approved, rejected or waitlisted, and the
transition is refused when it is not a legal one instead of silently overwriting a decision.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `POST /workspaces/:slug/events/:eventId/registrations/:registrationId/approve` | `registration:manage` | approve and issue a badge |
| `POST /workspaces/:slug/events/:eventId/registrations/:registrationId/reject` | `registration:manage` | reject with an optional reason |

## Rules

- The legal transitions are pure and tested:
  `PENDING → APPROVED | REJECTED | WAITLISTED`, `WAITLISTED → APPROVED | REJECTED`,
  and approving `APPROVED` is refused with `409 conflict`. `CANCELLED` and `REJECTED` are
  terminal.
- Approving records `decidedAt`, `decidedByUserId` and the optional reason in one write
  inside the tenant transaction. A rejected registration keeps its reason.
- Approving issues the badge through `BadgesService` in the same transaction, so a failure
  to issue cannot leave an approved registration without one.
- Automatic approval (module setting) reuses the same transition function; the two paths
  cannot disagree.
- Every decision appends an audit entry (`registration.approved`,
  `registration.rejected`).
- Another tenant's registration id is `not_found`, never a permission error.

## Acceptance (each becomes a test)

1. Approving a pending registration sets the status, the decider and the decision time.
2. Approving an already approved registration is refused with `conflict`.
3. Rejecting with a reason stores the reason; the badge is not issued.
4. A terminal status cannot be moved again.
5. Approval issues exactly one badge for the registration.
6. A decision on another tenant's registration is not found.
7. Automatic approval produces the same stored fields as a manual approve.

## Integration requests to the pre-flight

None beyond WP-10: the status enum, columns and routes exist in the same change.

## Out of scope

Waitlist promotion automation, capacity enforcement, notification emails about the
decision (the badge email is WP-13).

## Handover

- `registrations.rules.ts` holds the transition table; `registrations.service.ts` applies
  it and calls `BadgesService.issueForApproved`.
- Risk: category capacity is a stored number, not an enforced seat count; waitlists are a
  status, not a queue with ordering.
