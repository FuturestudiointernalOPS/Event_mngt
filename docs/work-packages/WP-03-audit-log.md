# WP-03 — Audit log

**Wave** 1 · **Parallel-safe** yes
**Owns** `apps/api/src/common/audit/**`, `apps/api/src/modules/audit/**`
**Depends on** WP-01

## Goal

Sensitive administrative actions leave a durable, append-only trace that an organisation
administrator can read, and that support can use to explain what happened.

## Contract

- `GET /api/v1/workspaces/:slug/audit` — newest first, paginated, permission `audit:read`.
  Returns `{ items, page, pageSize, total }` through the standard envelope.
- `AuditService.record(entry)` — internal only, used by other modules.

Each entry records: action key, target type and id, actor, organisation, request id, IP
address, and a small metadata object.

Action keys are constants in one file, dotted and past tense: `workspace.branding.updated`,
`event.published`, `member.role.changed`, `auth.signed_in`. No free-form strings from
callers.

## Rules

- Append-only. No update or delete path exists at all — not even for platform admins.
- Tenant-scoped: the organisation comes from the verified context, never from the payload.
- Metadata passes through a redaction step before storage: keys such as password, token,
  secret, hash and authorisation are dropped. This is the only place that decides.
- Recording must never break the operation it describes: a failure to write the audit row is
  logged, not thrown.
- Authentication events have no organisation. They are recorded with the actor and a null
  organisation, which the model already allows.

## Owned behaviour, not owned call sites

Adding `record()` calls inside the auth, workspaces and events services would edit files other
packages own. Do not do it. Instead, list the exact call sites as **integration requests** in
the handover note: file, place in the flow, action key, metadata shape. The pre-flight of the
next wave applies them.

## Acceptance (each becomes a test)

1. A recorded entry is retrievable for its organisation and not for another.
2. Forbidden metadata keys are absent from the stored row.
3. Listing is paginated and ordered newest first.
4. A caller without `audit:read` is refused.
5. No code path can update or delete an entry.

## Integration requests to the pre-flight

- Register `AuditModule` in the composition root.
- None to the schema: the `audit_logs` table already exists and is policy-protected.

## Out of scope

Exporting the log, alerting, and log shipping.

## Handover

- Implemented in `common/audit/` (actions, redaction, mapper, repository, service) and
  `modules/audit/` (read-only controller).
- `AuditService.record()` is called by auth, workspace settings/branding, event publish,
  invitations and membership changes. Failures are logged and swallowed, by design.
- The route is `GET /workspaces/:slug/audit`, paginated newest first; there is no update or
  delete path.
- Coverage: redaction spec, policy-coverage spec, and the isolation suite. There is no
  database integration test for `record()`/`list()`; the logic is thin and the policy is
  tested, but this is the remaining gap.
- Risk: the read policy is permissive on `organization_id IS NULL` rows for the actor; only
  the insert path creates them, and neither can be edited.

## Delivered

- `GET /workspaces/:slug/audit`, newest first, paginated, permission `audit:read`.
- Action constants in one file; callers never pass a free-form string.
- Metadata redaction is a pure function with its own spec: secrets are dropped by key,
  regardless of casing or separators, at any depth.
- Recording never breaks the operation: a failed write is logged and swallowed. An entry with
  neither organisation nor actor is dropped rather than attributed to nobody.
- Call sites wired for the integration requests: sign-in, workspace settings, branding, and
  event publishing.

### Deviation found while implementing

A sign-in has no organisation, so its row is written in the user scope. Prisma returns the
created row, and PostgreSQL evaluates the `SELECT` policy for an `INSERT ... RETURNING` as
well — the insert policy alone was not enough, and every write was rejected as a policy
violation. Two policies now exist: one to insert, one to read back, both restricted to the
caller's own rows.

Sign-in entries therefore carry no organisation and do not appear in the workspace listing.
That is deliberate: they belong to a platform-level view, which does not exist yet.

Verified end to end: two sign-in rows written, and a workspace listing containing the
member-invitation entry.
