# WP-08 — Idempotency and rate limits

**Wave** 1 · **Parallel-safe** yes
**Owns** `apps/api/src/common/idempotency/**`, `apps/api/src/common/guards/**`
**Depends on** WP-01

## Goal

A retried public request never creates two records, and a brute-force or burst client is
slowed down without leaking whether an account exists.

## Part A — Idempotency

Contract: `POST` routes that create something accept an `Idempotency-Key` header.

- The first request with a key stores the response it produced (status and body) together
  with a hash of the request payload.
- A replay with the same key and the same payload returns the **stored** response and creates
  nothing. It must not re-run the handler.
- A replay with the same key and a different payload is refused with `idempotency_conflict`.
- Keys are scoped to the organisation (or to the unauthenticated caller's route when there is
  no tenant) and expire after 24 hours.
- A request without the header behaves exactly as today. This is opt-in, not mandatory.

## Part B — Rate limits

Apply buckets where abuse is plausible, not everywhere:

| Group | Intent |
| --- | --- |
| sign-in | slow credential stuffing |
| registration and password reset | slow enumeration and email abuse |
| public registration submission | survive a launch-day burst |
| uploads | cap storage abuse |

Refusals use the standard envelope with code `rate_limited`, and the limit must be visible in
the API documentation.

## Rules

- Idempotency storage is database-backed, so it survives a restart and a second instance.
- The stored response contains no secret and no session token.
- A failed request (4xx) is not replayed as success; decide and document one behaviour.
- Limits are configuration, not constants scattered in guards.
- The guard order does not change: authentication, tenant, permissions, then these.

## Schema this package needs (declared for the pre-flight)

An idempotency table: organisation (nullable), key, request hash, response status, response
body, created at, expires at; unique on `(organizationId, key)`. Do not edit the schema.

## Acceptance (each becomes a test)

1. Same key and payload twice: one record created, identical response returned.
2. Same key, different payload: refused.
3. Expired key: treated as a new request.
4. No header: unchanged behaviour.
5. Sign-in attempts beyond the limit are refused with the documented code.
6. A refused request does not reveal whether the email exists.

## Integration requests to the pre-flight

- The idempotency model and migration, with an organisation predicate policy.
- `IdempotencyModule` registration and the global guard/decorator wiring in the composition
  root.
- Rate-limit dependency approval if a library is used; the team rule is to prefer an existing
  dependency or the platform, so justify it.

## Out of scope

Distributed locks, per-user quotas, and billing.

## Handover

- Implemented in `common/idempotency/` and `common/rate-limit/`; both modules are global.
  `Idempotent()` is applied to event creation, edition creation and invitation creation;
  `RateLimit()` is applied to register, verify-email, login, refresh, forgot-password and
  reset-password.
- Idempotency stores a pending row before the handler runs, then the response, keyed by
  `(scope, key)` and scoped by organisation, account or anonymous route+address. Concurrent
  replays get `idempotency_in_progress`; a different payload gets `idempotency_conflict`.
  Only successful (2xx) handler output is stored; a failed handler releases its pending row
  so it can be retried. `@Idempotent()` is deliberately not applied to authentication routes,
  so no session token can be captured in the replay cache.
- Rate limits use a fixed window with one atomic upsert; `Retry-After` is returned on a 429.
  Account identifiers are hashed, so the counter table is not an email list.
- Deviation recorded in `docs/12`: a database-backed implementation was chosen instead of
  adding `@nestjs/throttler`; Redis can replace the repository method later.
- Risk: expired idempotency rows and old rate-limit windows are not pruned periodically.
  Lazy expiry handles a reused key; a cleanup job belongs in wave 5. Anonymous idempotency
  rows have no organisation and are reachable without tenant context by design; they expire
  with the rest of the cache.
