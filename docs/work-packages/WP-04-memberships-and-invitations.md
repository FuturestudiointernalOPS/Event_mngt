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

## Delivered

- Five routes plus one: list members, list roles, invite, accept, change role, remove. The
  roles route was added because the invitation screen needs something to choose from.
- The invitation token is stored hashed, expires in seven days, and is single-use. Consumption
  is a conditional update, so two concurrent accepts cannot both succeed.
- Every invitation rejection shares one code and one message, including an address mismatch,
  so a token cannot be probed.
- A role id must belong to the same organisation; a foreign role is refused by reference.
- The last person able to manage the team cannot be removed or demoted.
- Removal takes effect on the next request because membership is resolved per request.
- Invitations, role changes and removals are recorded in the audit trail.

### Deviation

Accepting runs in two scopes: the invitation is read in the user scope (the invited address
can read only its own), then consumed and turned into a membership in the organisation scope.
The organisation comes from the invitation, never from the URL, which is why the scope is
organisation-wide rather than public.

Verified end to end: a pending invitation accepted by the invited account appears in the
member list, the audit trail records it, removing that member succeeds, and removing the last
administrator is refused with its own code.
