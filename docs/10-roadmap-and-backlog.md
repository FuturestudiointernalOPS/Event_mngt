# 10 — Roadmap and backlog

Indicative: **12–17 weeks** for a focused team of 2–4 developers, backend and frontend in
parallel. A planning estimate, not a commitment.

## Phases

| Phase | Scope | Est. | Exit criteria |
| --- | --- | --- | --- |
| 1. Foundation | Repo, architecture docs, ERD, Prisma, auth, tenants, permissions, tenant guards, RLS | 2 wk | Migrations run clean; cross-tenant tests pass; auth lifecycle works |
| 2. Organisation & branding | Onboarding, workspace settings, memberships, branding, storage adapter, org dashboard | 1–2 wk | Two orgs show different branding on one deployment |
| 3. Event management | Events, editions, lifecycle, module registry, event module config, publishing | 2 wk | Draft → configure → publish with valid dependencies |
| 4. Registration & profiles | Categories, dynamic forms, consent, approvals, people, registrations, badges, profiles, showcase | 2–3 wk | Public registration works, data correctly scoped, badges issued |
| 5. Event operations | Meetings, introduction queue, QR verification, check-in, offline sync | 2–3 wk | Critical operational flows + dedup pass |
| 6. Reporting | Aggregates, dashboards, edition comparison, CSV/PDF exports | 1–2 wk | Reports scoped; public metrics anonymised |
| 7. QA & security | Isolation, permissions, E2E, performance, recovery, penetration review | 1–2 wk | Quality gates signed off |
| 8. Innovation Village beta | Configure workspace + 2026 event, train staff, simulate, launch | 1 wk | Beta live, learning objectives instrumented |

## Delivery principles

- **P0 first, end to end.** One complete journey (onboard → publish → register → check in →
  report) beats five half-built modules.
- **Backend and frontend advance per phase**, not per layer. Each phase ends with a
  demonstrable workflow.
- **No P1/P2 work before P0 is validated** by the beta.
- **Every phase ends with tests, a changed-files summary and unresolved risks.**

## Epic backlog

### E1 — Platform foundation (Phase 1)

- E1.1 Monorepo, workspaces, shared contracts package, CI baseline
- E1.2 Environment contract and fail-fast configuration
- E1.3 Prisma schema, migration workflow, RLS policy scaffold
- E1.4 Prisma service, tenant context, tenant transactions
- E1.5 Response envelope, exception filter, request id, health endpoints
- E1.6 Swagger/OpenAPI generation

**Acceptance:** `GET /api/v1/health` and `/health/ready` behave; a deliberate cross-tenant
query returns zero rows; invalid env fails boot with a readable message.

### E2 — Identity and tenancy (Phase 1)

- E2.1 Register, verify email, login, logout, refresh rotation, reuse detection
- E2.2 Sessions list/revoke, account status
- E2.3 Organisations, memberships, roles, permission catalogue, seeding
- E2.4 Tenant resolution guard and permission guard
- E2.5 Audit log service and first events

**Acceptance:** registration → verification → login → refresh → logout all pass; a user
without a membership cannot reach a tenant route; reuse of a rotated refresh token revokes
all sessions.

### E3 — Workspace and branding (Phase 2)

- E3.1 Workspace creation, slug rules, settings
- E3.2 Branding tokens and validation, contrast warnings
- E3.3 Public workspace context endpoint
- E3.4 Storage adapter, logo/favicon upload with type and size checks
- E3.5 Team invitations and role assignment

**Acceptance:** onboarding completes without engineering help; two orgs render distinct
themes from one deployment.

### E4 — Events and modules (Phase 3)

- E4.1 Event CRUD, lifecycle transitions, visibility
- E4.2 Editions and recurrence links
- E4.3 Module registry endpoints, dependency validation
- E4.4 Event module settings with schema validation
- E4.5 Public event page projection

**Acceptance:** draft event configured with modules, validated, published, shareable;
invalid dependency rejected with a clear code.

### E5 — Registration and profiles (Phase 4)

- E5.1 Participant categories per event
- E5.2 Form definitions and field validation
- E5.3 Public registration submission, duplicate detection, idempotency
- E5.4 Consent records with versions
- E5.5 Approval workflow and status transitions
- E5.6 QR badge issuance and email delivery
- E5.7 Participant and organisation profiles, showcase listings, moderation

**Acceptance:** a public user registers with event-specific fields; changing a category in
one event never affects another; approved registration receives a working badge.

### E6 — Event operations (Phase 5)

- E6.1 Meeting interests, availability, proposals, accept/decline, outcomes
- E6.2 Introduction request queue, assignment, decisions, status history, outcomes
- E6.3 QR verification and check-in API
- E6.4 Offline scan sync with idempotent deduplication
- E6.5 Staff views: lookup, manual fallback, queue status

**Acceptance:** online check-in records attendance; offline scans sync without duplicates;
introduction flow reaches "introduced" with an outcome.

### E7 — Reporting (Phase 6)

- E7.1 Event aggregates and live counts
- E7.2 Organisation summaries across events
- E7.3 Edition comparison
- E7.4 CSV and PDF export via background jobs
- E7.5 Public anonymised statistics

**Acceptance:** metrics scoped correctly; exports complete asynchronously with status
feedback; public figures cannot be de-anonymised.

### E8 — Quality and launch (Phase 7–8)

- E8.1 Tenant isolation suite across all tenant tables
- E8.2 E2E: onboarding, publish, register, check-in, report
- E8.3 Performance: registration burst, check-in peak, report generation
- E8.4 Backup and restore drill
- E8.5 Security review, dependency scan, rate-limit tuning
- E8.6 Innovation Village configuration, staff training, simulation

**Acceptance:** all quality gates from the master plan pass; beta launched with
instrumentation for the learning objectives.

## Quality gates (from the source master plan)

- A new organisation onboards and brands itself without engineering intervention.
- An organisation creates, configures, saves a draft and publishes a shareable event page.
- A participant registers and receives the correct confirmation and badge.
- Changing a category in one event does not change another event's registration.
- Organisation A cannot reach B's private data through UI, API or direct database access.
- Valid QR check-in works online; offline scans sync without duplicate attendance.
- Reports are correctly scoped; public metrics are aggregated.
- French and English are supported.
- Automated tests cover isolation, permissions, onboarding, publishing, registration and
  check-in.

## Current status

Foundation, tenancy, workspace/branding, events/editions and the module registry are
implemented, together with the audit trail, memberships and invitations, brand asset uploads,
and idempotency/rate limits (work packages WP-01..WP-08). Wave 2 adds event categories and
forms, public registration with consent and duplicate policy, the approval workflow,
hashed-QR badges, participant and organisation profiles, showcase listings and the
participant read model (WP-09..WP-14). The tenant-isolation suite runs against a real
database and covers every tenant table. Event operations add online check-in with one
attendance row per registration, offline scan sync with per-scan outcomes, meetings and
the introduction queue with append-only status history (WP-15..WP-17). Reporting remains
(wave 4), followed by the wave 5 launch gates.
