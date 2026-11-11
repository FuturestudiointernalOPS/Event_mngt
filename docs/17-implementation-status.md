# 17 — Implementation status

What exists in the repository today, mapped to the roadmap in `10-roadmap-and-backlog.md`.
Updated alongside the code; if this file and the code disagree, the code wins and this file
is the bug. The API follows the work-package design (`14-backend-work-packages.md`,
`15-route-catalogue.md`) and the capability authorization model
(`16-capability-authorization.md`); the web app consumes exactly the routes in the catalogue.

## Phases

| Phase | Status | Notes |
| --- | --- | --- |
| 1. Foundation | Done | Auth, tenancy, RLS enforced end to end, audit, migrations |
| 2. Organisation & branding | Done | Onboarding, team and invitations, capability grants, branding and asset upload, dashboard |
| 3. Event management | Done | Lifecycle and transitions, editions, module registry with dependencies, publish validation |
| 4. Registration & profiles | Done | Categories, versioned form, versioned consent, approval, hashed QR badges, profiles and showcase moderation |
| 5. Event operations | Done | Meetings, introductions, check-in with offline sync and manual fallback |
| 6. Reporting | Done | Event and organisation summaries, edition comparison, queued CSV exports, anonymised public metrics |
| 7. QA & security | Partly | See below |
| 8. Innovation Village beta | Not started | Needs the decisions in `11-open-decisions.md`; runbook in `19-beta-runbook.md` |

## Web screens

Workspace (capability-gated): dashboard, events list and creation, event tabs (overview and
lifecycle, modules, registration setup, registrations with approve / reject / erase and the
badge panel, showcase, networking, check-in, reports and exports), team, access
(capabilities), branding with asset upload, data retention, event branding, audit log. Account: onboarding, security (MFA),
sign-in, registration, e-mail verification, password reset, invitation acceptance. Participant
space (`/participant`: badge QR, profile, meetings, introductions, my data). Public:
event page, dynamic registration form, showcase. Staff: mobile check-in scanner with offline
queue. Platform: organisation oversight.

## Known gaps in the product

- **Retention is manual.** The workspace sets `retentionMonths`; staff with
  `registrations.erase` preview and run the purge (`POST /workspaces/:slug/retention/purge`).
  There is no scheduled sweep yet: it needs a cross-tenant job scope that does not exist.
- **Participant self-service uses a secret link, not an account.** The badge e-mail carries
  `/participant?credential=…`; reissuing, revoking or withdrawing ends access (docs/03).
- **Event banner** is stored and shown on the public page; **colour overrides** apply to the
  public event page only (the staff shell keeps the workspace theme).
- **Resend (e-mail) and S3 (storage) adapters exist** and are unit-tested against fakes; they
  have never been run against the real services. `ses` is accepted by the environment
  contract but has no adapter.
- Meeting `proposedStart/End` are informational; no availability matching.
- PDF export is not implemented (CSV only).

## Quality evidence

- `npm run check:conventions`, `npm run test`, `npm run typecheck`, `npm run build`.
- `npm run test:isolation` (needs the database and the runtime role): tenant isolation on a
  real PostgreSQL, including a structural guard that every table with `organization_id` has
  forced row-level security.
- Route catalogue drift spec, capability registry spec, escalation specs, rate-limit specs,
  MFA specs (RFC 6238 vectors), job-runner specs, badge token specs.
- Web unit tests (shell regression, onboarding route, badge panel) and Playwright specs in
  `apps/web/e2e` (registration to approval and badge, consent refusal, unknown event,
  accessibility, mobile overflow, offline shell): last run 7 passed, 1 skipped (the offline
  shell spec needs a production build). They need a running stack and a Chromium matching the
  installed Playwright (`npx playwright install chromium`).
- `npm run test:isolation`: 56 tests on a real database, including the participant journey,
  retention purge, event branding and category capacity.
- `apps/api/scripts/load-test.ts` (current API): 100 concurrent registrations into an
  80-seat category accept exactly 80, every badge reaches its participant space, every badge
  scanned twice yields one attendance. Keep `--registrants` under the 120/min public budget.
- Last verified in a browser against the running stack: sign-in, onboarding, team, event
  tabs, public registration, approval, badge reissue (QR shown once), manual check-in.

## Not covered

- Never run against Supabase; everything was exercised on the Docker database.
- Camera scanning (jsQR) is untested on real phones.
- MFA is optional, including for platform administrators.
