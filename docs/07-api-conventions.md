# 07 — API conventions

Base path: `/api/v1`. Swagger at `/api/docs`. JSON only.

## Success envelope

Every successful response is wrapped so clients never guess:

```json
{
  "data": { "id": "…", "name": "Innovation Village 2026" },
  "meta": { "requestId": "01J…", "timestamp": "2026-11-08T10:00:00.000Z" }
}
```

Lists add pagination to `meta`:

```json
{
  "data": [ { "id": "…" } ],
  "meta": {
    "requestId": "01J…",
    "timestamp": "2026-11-08T10:00:00.000Z",
    "pagination": { "page": 1, "pageSize": 20, "total": 143, "totalPages": 8 }
  }
}
```

`204 No Content` responses stay empty — no envelope.

## Error envelope

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "details": [ { "path": "email", "message": "Invalid email address" } ]
  },
  "meta": { "requestId": "01J…", "timestamp": "2026-11-08T10:00:00.000Z" }
}
```

Rules:

- `code` is a stable, machine-readable snake_case identifier; `message` is human-readable
  and safe to display.
- Validation problems use `details[]` with field paths.
- Never leak stack traces, SQL, or another tenant's identifiers.
- Internal failures return `500 internal_error`; the real cause is logged with the
  `requestId`, which is also returned so support can correlate.
- `requestId` is accepted from an inbound `X-Request-Id` when present, otherwise
  generated.

## Status codes

| Code | Used for |
| --- | --- |
| 200 | Read, update, action completed |
| 201 | Resource created |
| 202 | Accepted for async processing (exports, password reset request) |
| 204 | Deleted, no body |
| 400 | Malformed request |
| 401 | Missing/invalid access token, refresh failure |
| 403 | Authenticated but not permitted in this tenant |
| 404 | Missing, or not visible to this tenant |
| 409 | Conflict: duplicate registration, duplicate slug, dependency already enabled |
| 422 | Business rule violation (`module_dependency_unmet`, `registration_closed`) |
| 423 | Locked: event published and immutable in the requested way |
| 429 | Rate limited, includes `Retry-After` |
| 500 | Unexpected failure |

## Error codes in use (growing)

`validation_error`, `unauthorized`, `invalid_credentials`, `token_expired`,
`refresh_reuse_detected`, `forbidden`, `permission_denied`, `not_found`,
`tenant_not_found`, `membership_required`, `conflict`, `slug_taken`,
`module_dependency_unmet`, `registration_closed`, `duplicate_registration`,
`rate_limited`, `internal_error`.

Module activation and uploads add: `invalid_module`, `module_core_required`,
`module_dependency_missing`, `module_required_by_other`, `invalid_module_settings`,
`invalid_module_change`, `invalid_idempotency_key`, `idempotency_conflict`,
`idempotency_in_progress`, `file_required`, `file_too_large`, `file_type_not_allowed`,
`file_type_mismatch`.

Reporting adds: `export_not_ready`, `export_expired`, `export_failed`.

Onboarding and platform oversight add: `email_not_verified`, `account_suspended`,
`organization_setup_failed`, `owner_not_found`, `owner_not_available`.

## Versioning

- The major version lives in the path (`/api/v1`). Breaking changes create `/api/v2`; v1
  stays supported through a documented deprecation window.
- Additive changes (new optional fields, new endpoints) do not bump the version. Clients
  MUST ignore unknown fields.

## Pagination, sorting, filtering

- Query: `?page=1&pageSize=20&sort=-createdAt&status=published`.
- `pageSize` is capped server-side (default 20, max 100).
- `sort` accepts a comma-separated list; `-` means descending. Only whitelisted fields are
  sortable.
- Filters are explicit query parameters — no free-form query language in v1.
- Cursor pagination is introduced only where offset pagination is proven inadequate
  (large participant lists, check-in feeds).

## Validation

- Zod schemas from `packages/shared/src/contracts` are the single source of truth.
- The API validates with `ZodValidationPipe` at the boundary; unknown keys are stripped,
  never merged.
- The web app reuses the same schemas with React Hook Form for instant feedback. Client
  validation is UX; server validation is truth.

## Idempotency and duplication

Registration submission and check-in sync accept an `Idempotency-Key` header (or a stable
scan identifier). Repeating the same key returns the original result instead of creating a
second record. Unique constraints back this up at the database level.

## Public endpoints

- Prefix: `/api/v1/public/…`.
- No session required; tenant resolved from the slug.
- Responses use dedicated public projections: approved data only, no contacts, no internal
  notes, no cross-event identifiers.
- Unlisted events are reachable by direct URL but excluded from listing and search.
- Private events return `404` publicly.

## Capabilities in documentation

Every Swagger operation states the required capability (`@RequireCapability`). The
generated spec is the contract reviewers use to answer "who can call this".

## Route inventory

Each feature module has a `routes.ts` listing its routes as method, path, capability and
controller method. The full table is in [`15-route-catalogue.md`](15-route-catalogue.md).
A test compares the catalogues with the decorator metadata on the controllers, so a route
cannot exist in only one place and a capability cannot change silently.

## Rate limits

Budgets are fixed windows stored in PostgreSQL and declared per route. Where a session
exists the key is the account id; public flows use the client address or a hashed account
identifier. Exceeding a budget returns `429` with `Retry-After`.

| Surface | Key | Production budget |
| --- | --- | --- |
| Account registration | address | 5 / 10 minutes |
| Email verification | address | 20 / 10 minutes |
| Sign-in | address + account | 60 / minute and 10 / 5 minutes |
| Session refresh | address | 300 / minute |
| Password-reset request | address + account | 10 / 15 minutes and 3 / 15 minutes |
| Password-reset completion | address | 10 / 15 minutes |
| MFA setup / enable / disable | account | 10 / 5 minutes each |
| Workspace creation | account | 5 / hour |
| Member invitation | account | 50 / hour |
| Report export creation | account | 30 / hour |
| Public event registration | address | 120 / minute |
| Check-in sync | account + address | 120 / minute and 600 / minute |

`TRUST_PROXY` must match the real reverse-proxy hop count in production, otherwise every
per-address budget collapses into one budget for the proxy. The numbers live in one policy
file so tuning is a reviewable change, not a controller edit. Counter rows older than the
retention period (48 hours by default) are deleted every six hours.

## Contract change process

1. Change the Zod schema in `packages/shared`.
2. Update or add the contract test in `apps/api/test/contracts`.
3. Regenerate/adjust frontend usage — TypeScript fails if a consumer is out of date.
4. Note the change in the PR description with the affected endpoints.
