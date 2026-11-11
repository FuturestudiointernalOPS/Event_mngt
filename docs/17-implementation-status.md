# 17 — Implementation status

What exists in the repository today, mapped to the roadmap in `10-roadmap-and-backlog.md`.
Updated alongside the code; if this file and the code disagree, the code wins and this file
is the bug.

## Phases

| Phase | Status | Notes |
| --- | --- | --- |
| 1. Foundation | Done | Auth, tenancy, RLS enforced end to end, audit, migrations |
| 2. Organisation & branding | Done | Workspace creation, team, invitations, logo/favicon upload, dashboard |
| 3. Event management | Done | Lifecycle, editions, module registry with dependencies, publish validation |
| 4. Registration & profiles | Done | Categories, dynamic form, consent, approval, QR badges, showcase moderation |
| 5. Event operations | Done | Meetings (with staff confirmation), introduction queue, check-in with offline sync |
| 6. Reporting | Done (durable) | Dashboards, edition comparison, CSV export, anonymised public figures |
| 7. QA & security | Partly | See "Quality evidence" and "Not covered" below |
| 8. Innovation Village beta | Not started | Needs the decisions in `11-open-decisions.md`; runbook in `19-beta-runbook.md` |

## What was added beyond the original plan

- **Self-service organisation onboarding**: a signed-in account creates a workspace and
  becomes its first administrator, with default entitlements and system roles.
- **Platform organisation lifecycle**: create on behalf of an existing account, suspend,
  reactivate and read an audited support summary across tenants.
- Self-service **personal-data rights**: participant export and erasure, staff erasure,
  per-workspace retention period with a daily sweep.
- **Super Admin module availability** and organisation suspension.
- **Event appearance is only partly built**: the event screen offers colour overrides and a
  banner upload, but the server still reports `bannerUrl` and `brandOverrides` as empty and
  has no banner route. Events inherit workspace branding until that slice is finished.
- **Rate limiting**, a **durable Redis/BullMQ job runner** for e-mail and exports
  (retries, fallback when Redis is absent), an offline **service worker**, one-command
  **local environment**.
- **Two-factor authentication** (TOTP, recovery codes, lockout) for any account, with
  encrypted secrets and audit entries.
- **Delegation escalation guards**: a grantor cannot hand out a capability they do not
  hold, and a role assignment or invitation cannot exceed the actor's effective set.
- **Production rate-limit policy**: per-route budgets, account-keyed buckets, and
  proxy-aware client addressing.

## Deliberate deviations from the source plans

| Plan | Implementation | Why |
| --- | --- | --- |
| `registration_forms` + `registration_answers` tables | One form per event (`registration_fields`), answers as JSON on the registration | Simpler; per-event forms were the only requirement. Revisit if answers must be queried |
| Participant portal | Not built in this release. Public pages plus the badge e-mail cover registration and check-in. | The portal needs a credential column and its own capability set; the abandoned attempt had neither and did not compile (`b875908`). |
| Event slug unique per organisation | Unique platform-wide | Public URLs are `/e/:eventSlug` |
| `/staff/:eventId/check-in` | `/staff/:slug/:eventId/check-in` | The API needs the workspace slug |
| `ses` e-mail provider | Not implemented (console, Resend) | One real provider is enough for the beta |
| P1/P2 modules | Catalogued, cannot be enabled | Plan: no P1/P2 before the P0 beta is validated |

## Quality evidence

- `npm run check:conventions`, `npm run test`, `npm run typecheck`, `npm run build`.
- **HTTP journey specs** (`apps/api/test/*.e2e-spec.ts`): team and invitations, events and
  modules, branding uploads, and registration → approval → badge → check-in → report. They
  set up fixtures as the database owner, then assert only through HTTP. They skip themselves
  unless
  `E2E_BASE_URL`, `TEST_OWNER_DATABASE_URL` and `TEST_APP_DATABASE_URL` are set; see
  `AGENTS.md`.
- **What the restored journeys deliberately use**: manual check-in by registration, because
  the raw badge token is never retrievable, and a rewritten invitation hash, because the
  token is only sent by e-mail.
- **Tenant isolation spec** (`apps/api/src/database/tenant-isolation.spec.ts`): real
  PostgreSQL, non-owner role. Includes a structural guard that fails if a table with
  `organization_id` has no forced RLS policy.
- **Capability registry guard**: every capability must be well formed, point its
dependencies at real keys, keep its legacy permission mapping, and stay in step with the
typed constants.
- **Permission catalogue guard**: every legacy permission key in `packages/shared` must be
  inserted by a migration.
- **Redis integration spec** (`REDIS_TEST_URL`): e-mail delivery, retry, give-up.
- **Job runner unit specs**: Redis URL parsing, durable-queue fallback, export retry and
  stale-claim recovery.
- **Escalation specs**: delegation cannot exceed the actor's capabilities, role changes
  and invitations cannot confer a stronger role, platform claims do not stand in for
  workspace membership, and workspace capabilities do not grant platform access.
- **Rate-limit specs**: window arithmetic, hashed account keys, account-keyed buckets,
  and guard fall-through when a key source is absent.
- **MFA specs**: RFC 6238 TOTP vectors, encrypted secrets, recovery-code single use,
  lockout, enrolment and disable.
- **Rate limit spec** (`E2E_THROTTLED_URL`): needs an API with limits on.
- **Load and correctness test** (`apps/api/scripts/load-test.ts`): registration burst never
  oversells a category, check-in never double counts. Local single node, 50 concurrent:
  registration ~350 req/s (p95 185 ms), check-in ~570 req/s (p95 109 ms), public page
  ~2600 req/s (p95 24 ms).
- **Accessibility**: axe (WCAG 2 A/AA, 2.1 A/AA) run on login, public event, registration,
  dashboard, team, branding, event tabs and the check-in screen: no violations. Mobile
  width: no horizontal overflow.
- **Browser tests** (`apps/web/e2e`, Playwright, Chromium): 8 tests pass: public registration
  to staff confirmation, consent refusal, unknown event, WCAG A/AA on public pages (desktop
  and phone), no horizontal overflow, and the app shell loading offline after one visit
  (production build). Needs a running stack; see `apps/web/playwright.config.ts`.

## Not covered / known limits

- **Never run against Supabase.** Everything was exercised on the Docker database.
  Follow `18-deployment-and-operations.md`, then re-run the journey specs and the load test
  against staging.
- **The HTTP journey specs need a running stack.** They are not part of `npm test`'s green
  count unless the three variables are present; a CI job without a database reports them as
  skipped, not as passing.
- **The participant portal does not exist.** Participants use the public event page, the
  registration form, the public showcase and the badge link. There is no signed-in
  participant area.
- **Event appearance is incomplete.** The screen sends `brandOverrides` and posts a banner to
  a route the server does not expose; the event falls back to workspace branding.
- **Camera scanning** (jsQR) is untested on real phones; the decode loop and the offline
  queue are covered by unit tests and the manual fallback.
- **PDF export is a plain text table**, not a designed document: Helvetica rows, no logo or
  images. It is unit-tested for a valid PDF container, not visually reviewed.
- **S3** adapter is unit-tested with a stubbed client, not against a real bucket.
- **Resend** adapter is unit-tested with a stubbed `fetch`, not against the real API.
- MFA is optional, including for platform administrators.
- Meeting `proposedStart/End` are informational; there is no calendar or availability matching.
- No password-breach check, no device-trust, no IP allow-listing for the Super Admin.
