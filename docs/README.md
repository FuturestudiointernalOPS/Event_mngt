# Architecture documentation

Consolidated engineering documentation for the Event Platform. This set replaces the
four source plans (`*_Development_Plan.docx`, `Future_Studio_*PRD*.docx`) plus the
Innovation Village concept note as the working reference. Where the source documents
disagreed, the stricter interpretation wins and the deviation is recorded in
`11-open-decisions.md`.

## Index

| Document | Answers |
| --- | --- |
| [00-product-scope.md](00-product-scope.md) | What we are building, for whom, and what is explicitly out of scope |
| [01-system-architecture.md](01-system-architecture.md) | How the pieces fit together at runtime |
| [02-data-model-and-erd.md](02-data-model-and-erd.md) | Entities, relationships, and the Phase 1 Prisma schema |
| [03-tenant-isolation-and-rls.md](03-tenant-isolation-and-rls.md) | How one organisation is prevented from reading another's data |
| [04-authentication-and-sessions.md](04-authentication-and-sessions.md) | Custom auth, tokens, cookies, rotation, revocation |
| [05-branding-and-theming.md](05-branding-and-theming.md) | How white-label theming is resolved and applied |
| [06-module-registry.md](06-module-registry.md) | How event-level modules are declared, enabled and validated |
| [07-api-conventions.md](07-api-conventions.md) | Envelope, errors, pagination, versioning, idempotency |
| [08-backend-architecture.md](08-backend-architecture.md) | NestJS module map, layering rules, testing strategy |
| [09-frontend-architecture.md](09-frontend-architecture.md) | Route map, feature folders, server state, offline check-in |
| [10-roadmap-and-backlog.md](10-roadmap-and-backlog.md) | Phases, exit criteria, epic backlog |
| [11-open-decisions.md](11-open-decisions.md) | Unresolved product/business questions with owners |
| [12-dependency-and-security.md](12-dependency-and-security.md) | Audit posture, applied upgrades, deferred migrations, re-review triggers |
| [13-coding-rules.md](13-coding-rules.md) | Binding coding rules: 300-line limit, controller → service → repository, tenancy, enforcement |
| [14-backend-work-packages.md](14-backend-work-packages.md) | The backend plan split into self-contained packages that can run in parallel |
| [15-route-catalogue.md](15-route-catalogue.md) | Every server route, grouped by module, with the test that keeps it honest |

## Decisions already made (do not re-litigate without cause)

1. **Supabase is a PostgreSQL host and nothing else.** The PRD table that proposed
   Supabase Auth and Supabase Storage is superseded by the master plan, the backend plan
   and both implementation prompts.
2. **One shared deployment, many tenants.** No per-organisation builds or forks.
3. **Modular monolith, not microservices.** Modules are folders with explicit
   boundaries and dependency rules inside one deployable API.
4. **Zod contracts shared between API and web.** One source of truth for request and
   response shapes, used for runtime validation on both sides.
5. **Tenant context is derived server-side from verified membership**, never from a
   client-supplied `organizationId`.
6. **Account ≠ Person ≠ Registration.** Public registration requires no account.
7. **French and English from the first release.** No user-facing strings in business
   logic.

## Conventions in these documents

- `MUST` / `MUST NOT` mark hard requirements enforced by tests.
- "Phase" refers to the delivery roadmap in `10-roadmap-and-backlog.md`.
- Code references use repository-relative paths so they stay clickable.
