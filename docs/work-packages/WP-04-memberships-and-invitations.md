# WP-04 — Memberships and invitations

**Wave** 1 · **Parallel-safe** yes
**Owns** `apps/api/src/modules/memberships/**`
**Depends on** WP-01

## Goal

An organisation administrator can add a colleague by email, change what that person may do,
and remove them — without engineering help.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `GET /workspaces/:slug/members` | `member:read` | list members with role and status |
| `POST /workspaces/:slug/invitations` | `member:manage` | invite an email with a role |
| `POST /auth/invitations/:token/accept` | public (signed-in) | join the workspace |
| `PATCH /workspaces/:slug/members/:memberId` | `member:manage` | change role |
| `DELETE /workspaces/:slug/members/:memberId` | `member:manage` | remove access |

The accept route lives on the auth surface but is implemented here; register the controller
under the memberships module with that path.

## Rules

- The role must belong to the **same organisation**. A role id from another tenant is
  refused with a clear code, not resolved by fallback.
- Only a hashed invitation token is stored. The raw token appears once, in the email.
- Invitations expire (7 days) and are single-use: accepting marks them consumed.
- The accepting user's verified email must match the invitation, otherwise the invitation is
  not usable — same generic message either way, so nothing is revealed.
- Inviting someone who is already a member is a conflict, not a silent update.
- An organisation must keep at least one member holding `member:manage`; removing or demoting
  the last one is refused.
- Removal takes effect immediately: the guard resolves membership per request, so no session
  invalidation is needed.

## Schema this package needs (declared for the pre-flight)

An `Invitation` model: organisation, email, role, token hash, invited-by user, expires at,
consumed at, created at; unique on `(organizationId, email)` where not yet consumed. Do not
edit the schema yourself.

## Acceptance (each becomes a test)

1. Invitation → accept → the member appears and can reach a tenant route.
2. A role from another organisation is rejected.
3. A consumed or expired token is rejected.
4. An email mismatch is rejected with the same message as an unknown token.
5. Inviting an existing member returns a conflict.
6. Removing the last administrator is refused.
7. After removal, the next request from that user is refused.

## Integration requests to the pre-flight

- The `Invitation` model and its migration.
- `MembershipsModule` registration in the composition root.
- Policy for the new table (organisation predicate) in the RLS file.

## Out of scope

Custom roles beyond the system templates, SSO, and bulk import.
