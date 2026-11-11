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
(capabilities), branding with asset upload, audit log. Account: onboarding, security (MFA),
sign-in, registration, e-mail verification, password reset, invitation acceptance. Public:
event page, dynamic registration form, showcase. Staff: mobile check-in scanner with offline
queue. Platform: organisation oversight.

## Known gaps in the product

- **No participant portal.** A registrant gets a receipt reference on screen and the badge
  code by e-mail (as text). There is no page that shows them their QR badge; staff can
  reissue a badge and show or print its QR from the registrations tab (the code is displayed
  once).
- **No workspace-level retention or purge, and no participant-initiated export or erasure.**
  Staff can erase one registration (`registrations.erase`).
- **No event-level branding** (banner, colour overrides): the contract fields exist and are
  always null.
- **Integrations are console-only.** `EMAIL_PROVIDER` and `STORAGE_PROVIDER` accept
  `resend` / `ses` / `s3` in the environment contract, but only the console adapters are
  implemented, so nothing is actually sent or stored externally yet.
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
  accessibility, mobile overflow, offline shell). The Playwright specs need a running stack
  and a Chromium matching the installed Playwright (`npx playwright install chromium`).
- `apps/api/scripts/load-test.ts`: registration burst and check-in correctness under
  concurrency (written against an earlier API surface; re-check its routes before relying
  on it).
- Last verified in a browser against the running stack: sign-in, onboarding, team, event
  tabs, public registration, approval, badge reissue (QR shown once), manual check-in.

## Not covered

- Never run against Supabase; everything was exercised on the Docker database.
- Camera scanning (jsQR) is untested on real phones.
- MFA is optional, including for platform administrators.
