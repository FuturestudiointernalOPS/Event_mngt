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
| 3. Event management | Done | Lifecycle and transitions, editions, module registry with dependencies, publish validation, per-event banner and colours |
| 4. Registration & profiles | Done | Categories, one form per event, versioned consent, approval, hashed QR badges, profiles and showcase moderation |
| 5. Event operations | Done | Meetings, introductions, check-in with offline sync and manual fallback |
| 6. Reporting | Done | Event and organisation summaries, edition comparison, queued CSV/PDF exports, anonymised public metrics |
| 7. QA & security | Partly | Two-factor, escalation guards, rate limits and the isolation spec are in place; data retention and participant rights are not built (plan: `20-privacy-retention-and-participant-rights.md`) |
| 8. Innovation Village beta | Not started | Needs the decisions in `11-open-decisions.md`; runbook in `19-beta-runbook.md` |

## Screens

**Account.** Sign-in, registration, e-mail verification, password reset, invitation
acceptance, security (two-factor), and self-service onboarding where a signed-in account
creates a workspace and becomes its first administrator without a platform administrator.

**Workspace** (capability-gated). Dashboard, events list and creation, team, access
(capability grants), branding with asset upload, audit log.

**Event.** Tabs for overview and lifecycle, modules, registration setup, registrations
(approve, reject, erase, badge panel with reissue and a QR shown once), showcase, networking,
check-in, reports and exports. The overview also carries the **appearance** panel: a banner
upload and up to three colour overrides; anything left unset inherits the workspace.

**Public and staff.** Public event page, registration form and showcase; a staff check-in
page with an offline queue and a manual fallback.

**Platform.** A console that lists workspaces with their status and toggles the capabilities
each workspace is entitled to. Creating a workspace on someone's behalf, suspend/reactivate
buttons and an audited support summary are **not** in the screen; suspension exists in the
API under `platform.organizations.manage`.

## Where the build deliberately differs

| Decision | What the code does | Why |
| --- | --- | --- |
| Registration forms | One form per event (enforced unique), a version number on the form, and answers stored as separate rows keyed by the question key | A form edit must not orphan past answers; answers stay queryable |
| Public event address | The slug is unique **platform-wide**, enforced by a unique index; a generated slug that collides is retried once with a random suffix, a slug typed by the user is refused | The public address is the slug alone, so the lookup has nothing else to disambiguate with; two workspaces could otherwise publish the same address and one would win arbitrarily |
| Staff check-in route | `/staff/:slug/:eventId/check-in` | The API resolves the workspace from its slug |
| Event appearance | `banner_url` plus three nullable colour columns on the event; null means inherit | No backfill, and the editing screen can tell "set" from "inherits" |
| Upload storage | Local disk by default (`local`), served by the API at `/static`; `console` only logs; `s3` has no adapter yet and falls back to console | One deployment, one server for the beta; the port is already in place for an object store |
| Event slug changes | A unique violation is translated into a `slug_taken` conflict instead of leaking a database error | The user needs an actionable message |

## Known limits

- **Participant space uses a secret link, not an account.** The badge e-mail carries
  `/participant?credential=…` (badge QR, profile, meetings, introductions, export, withdraw,
  erase); reissuing, revoking or withdrawing ends access (docs/03).
- **Retention is manual.** The workspace sets `retentionMonths`; staff with
  `registrations.erase` preview and run the purge (`POST /workspaces/:slug/retention/purge`).
  There is no scheduled sweep yet: it needs a cross-tenant job scope that does not exist.
  The wider plan is in `20-privacy-retention-and-participant-rights.md`.
- **Resend (e-mail) and S3 (storage) adapters exist** but have only been run against fakes,
  never the real services. `ses` is accepted by the configuration but has no adapter.
- **Storage is single-server unless `s3` is selected.** The local provider writes to
  `LOCAL_STORAGE_DIR`.
- **Modules at P1/P2 are catalogued and can be enabled.** There is no priority gate; the
  dependency rules and the core module are the only constraints.
- **Meeting times are informational.** `proposedStart`/`proposedEnd` are stored, with no
  availability matching.
- **PDF export is a plain text table** (Helvetica rows, no logo or images). It is
  unit-tested for a valid PDF container, not visually reviewed.
- **Two-factor is optional**, including for platform administrators.
- **MFA, e-mail and storage adapters are unit-tested against stubs**, not against real
  providers.

## Quality evidence

- `npm run check:conventions`, `npm run test`, `npm run typecheck`, `npm run build`.
- **HTTP journey specs** (`apps/api/test/*.e2e-spec.ts`): team and invitations, events and
  modules, branding uploads, and registration → approval → badge → check-in → report — four
  files, fourteen tests. They create fixtures as the database owner, then assert only through
  HTTP. They skip themselves unless `E2E_BASE_URL`, `TEST_OWNER_DATABASE_URL` and
  `TEST_APP_DATABASE_URL` are set; see `AGENTS.md`. The restored journeys use manual check-in
  by registration, because the raw badge token is never retrievable, and a rewritten
  invitation hash, because the token is only sent by e-mail.
- **Tenant isolation spec** (needs a real PostgreSQL and the runtime role): cross-tenant reads
  and writes refused through HTTP, plus a structural guard that fails when a table with
  `organization_id` has no forced row-level security.
- **Catalogues that cannot drift**: every controller route must appear in the route
  catalogue, and every capability key must exist in the registry and in a migration.
- **Behaviour specs beside the code**: escalation guards, rate-limit budgets and windows,
  MFA (RFC 6238 vectors, encrypted secrets, recovery single-use, lockout), job runner and
  export retries, badge tokens, event mapping and the public theme merge, slug conflict
  retry, image upload rules, and the local storage adapter.
- **Web unit tests**: shell regression, onboarding route, badge panel, event appearance.
- **Browser tests** (`apps/web/e2e`, Playwright, Chromium): six tests, eight runs — the
  accessibility and mobile-width specs also run on the phone profile. They cover public
  registration to staff confirmation, consent refusal, unknown event, accessibility, mobile
  overflow and the offline shell. They need a running stack and a matching Chromium.
- **Load test** (`apps/api/scripts/load-test.ts`, current API): 100 concurrent registrations
  into an 80-seat category accept exactly 80; every badge reaches its participant space; every
  badge scanned twice yields one attendance. Keep `--registrants` under the 120/min budget.
- **Isolation suite** also covers the participant journey, retention purge and category
  capacity (category capacity is enforced at submission under a row lock).

## Not covered

- **Never run against Supabase.** Everything was exercised on the Docker database. Follow
  `18-deployment-and-operations.md`, then re-run the journey specs and the load test on
  staging.
- **The journey specs need a running stack.** Without the three variables a CI job reports
  them as skipped, not as passing.
- **Camera scanning** (jsQR) is untested on real phones; the decode loop and the offline queue
  are covered by unit tests and the manual fallback.
- **No participant-facing data rights.** Public pages, the registration form, the showcase and
  the badge link are the whole participant experience.
- **The platform console is read-mostly**: no impersonation, no support summary, no
  suspend/reactivate control.
