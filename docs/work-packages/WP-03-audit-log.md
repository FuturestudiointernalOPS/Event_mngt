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
