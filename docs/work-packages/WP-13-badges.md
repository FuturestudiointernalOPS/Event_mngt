# WP-13 — Badges

**Wave** 2 · **Parallel-safe** yes
**Owns** `apps/api/src/modules/badges/**`
**Depends on** WP-10 (registration rows), WP-07 (storage/email adapters)

## Goal

Every approved registration gets one badge whose QR payload can be verified later, and the
raw token leaves the server exactly once instead of being stored in a readable table.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `GET /workspaces/:slug/events/:eventId/badges` | `registration:read` | paginated badge list |
| `GET /workspaces/:slug/events/:eventId/registrations/:registrationId/badge` | `registration:read` | badge state, no raw token |
| `POST /workspaces/:slug/events/:eventId/registrations/:registrationId/badge/reissue` | `registration:manage` | rotate the token, return it once |
| `POST /workspaces/:slug/events/:eventId/registrations/:registrationId/badge/revoke` | `registration:manage` | revoke; verification will fail |

`BadgesService.issueForApproved(tx, registration)` is called by WP-10 and WP-12 inside
their transaction.

## Rules

- The token is 32 random bytes, base64url-encoded. Only its SHA-256 hash is stored. The raw
  value is returned once, from issuance or reissue, and appears in the confirmation email.
- One badge row per registration (unique `registrationId`). Reissuing rotates the hash,
  increments `reissueCount` and restamps `issuedAt`; the previous QR stops verifying.
- Issuing is idempotent for an already-issued badge: it returns the existing state and does
  not create a second row.
- Only an `APPROVED` registration can be issued a badge. Issuing for another status is
  `422 invalid_status_transition`.
- Revoking sets the status and timestamp; the row is retained, never deleted.
- Staff reads never return a token. The verification path (WP-15) will hash the scanned
  value; no endpoint here accepts a token as input yet.
- Every query carries the tenant predicate; another tenant's registration is `not_found`.
- The confirmation email goes through the email port; with the console adapter it is
  logged, with a real provider it is delivered. A failed email never rolls back the badge.

## Acceptance (each becomes a test)

1. Issuing for an approved registration stores only a hash, and the returned token hashes
   to it.
2. Issuing twice returns the same badge and does not create a second row.
3. Issuing for a pending registration is refused.
4. Reissuing changes the hash and increments the count; the old token no longer matches.
5. Revoking keeps the row and marks it revoked.
6. Staff lists and details contain no token.
7. A badge for another tenant's registration is not found.

## Integration requests to the pre-flight

- Schema: `Badge` (frozen).
- Contracts: `contracts/badges.ts`.
- Register `BadgesModule`, export `BadgesService`; catalogue its routes.

## Out of scope

QR image rendering (the payload is a string the web app renders), check-in verification
(WP-15), offline sync (WP-16) and badge templates.

## Handover

- `badges.*` inside `modules/badges/`; token creation and hashing are pure and tested.
- Risk: because only the hash is stored, a lost token cannot be recovered — reissue is the
  only path, and it invalidates the previous badge. That is intentional.
