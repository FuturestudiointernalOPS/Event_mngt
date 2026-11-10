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
| 6. Reporting | Done (sync) | Dashboards, edition comparison, CSV export, anonymised public figures |
| 7. QA & security | Partly | See "Quality evidence" and "Not covered" below |
| 8. Innovation Village beta | Not started | Needs the decisions in `11-open-decisions.md`; runbook in `19-beta-runbook.md` |

## What was added beyond the original plan

- Self-service **personal-data rights**: participant export and erasure, staff erasure,
  per-workspace retention period with a daily sweep.
- **Two-factor authentication** (TOTP, recovery codes, lockout) for any account.
- **Event-level branding**: banner image and colour overrides, inheriting the workspace.
- **Super Admin module availability** and organisation suspension.
- **Rate limiting**, **queued e-mail** with retry (Redis/BullMQ), Resend and S3 adapters,
  an offline **service worker**, one-command **local environment**.

## Deliberate deviations from the source plans

| Plan | Implementation | Why |
| --- | --- | --- |
| `registration_forms` + `registration_answers` tables | One form per event (`registration_fields`), answers as JSON on the registration | Simpler; per-event forms were the only requirement. Revisit if answers must be queried |
| Participant "account" for portal features | E-mailed bearer credential (`orgId.registrationId.secret`, hash stored) | Public registration needs no account; the secret, not the org id, proves access |
| Event slug unique per organisation | Unique platform-wide | Public URLs are `/e/:eventSlug` |
| `/staff/:eventId/check-in` | `/staff/:slug/:eventId/check-in` | The API needs the workspace slug |
| `ses` e-mail provider | Not implemented (console, Resend) | One real provider is enough for the beta |
| P1/P2 modules | Catalogued, cannot be enabled | Plan: no P1/P2 before the P0 beta is validated |

## Quality evidence

- `npm run check:conventions`, `npm run test`, `npm run typecheck`, `npm run build`.
- **HTTP journey specs** (`apps/api/test/*.e2e-spec.ts`): team and invitations, events and
  modules, registration, participants and operations, branding uploads, MFA / data rights /
  platform modules. They need a running API + database (see `AGENTS.md`).
- **Tenant isolation spec** (`apps/api/src/database/tenant-isolation.spec.ts`): real
  PostgreSQL, non-owner role. Includes a structural guard that fails if a table with
  `organization_id` has no forced RLS policy.
- **Permission catalogue guard**: every key in `packages/shared` must be inserted by a
  migration.
- **Redis integration spec** (`REDIS_TEST_URL`): e-mail delivery, retry, give-up.
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
- **Camera scanning** (jsQR) is untested on real phones; the decode loop and the offline
  queue are covered by unit tests and the manual fallback.
- **PDF export** is not implemented (CSV only). Exports are synchronous.
- **S3** adapter is unit-tested with a stubbed client, not against a real bucket.
- **Resend** adapter is unit-tested with a stubbed `fetch`, not against the real API.
- MFA is optional, including for platform administrators.
- Meeting `proposedStart/End` are informational; there is no calendar or availability matching.
- No password-breach check, no device-trust, no IP allow-listing for the Super Admin.
