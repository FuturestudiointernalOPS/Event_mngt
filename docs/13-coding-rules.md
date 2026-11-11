# 13 — Coding rules

Binding rules for anyone — human or coding agent — writing code in this repository.
They exist because a multi-tenant product fails quietly: one missing tenant predicate or
one 800-line file is enough to make later work unreliable.

Read this before writing code. `AGENTS.md` at the repository root is the short version.

## Precedence

1. `03-tenant-isolation-and-rls.md` and `04-authentication-and-sessions.md` win over
   anything here.
2. This document wins over personal style.
3. When a rule is genuinely wrong for a case, change the rule in the same commit and say
   why — do not silently break it.

## How these rules are enforced

| Layer | Mechanism |
| --- | --- |
| Machine-checked | `npm run check:conventions` — file size, controller/data-layer separation, cross-module data access, single client entry point, environment access |
| Machine-tested | `npm run test:conventions` — the gate itself is exercised against fixture violations; the API suite's route-coverage and capability-registry tests enforce R12 |
| Type-checked | `npm run typecheck` across all three workspaces |
| Reviewed | Everything else in this document |
| Blocking | Nothing merges with a failing check, a failing test, or a rule broken without a recorded reason |

`npm run lint` runs the conventions gate first, then the workspaces' type checks.

---

# Part A — Hard rules

Every rule in this part is a blocker.

### R1 — No source file over 300 lines

No new file may exceed **300 lines**. Files between 270 and 300 are a warning: split before
adding. Applies to `.ts` and `.tsx` under `apps/api/src`, `apps/web/src`,
`packages/shared/src`. Generated code, migrations and build output are excluded.

### R2 — A controller never touches the database

Controllers read the request, call exactly one service method, and return. They MUST NOT
import the data layer, hold a client, or contain business branching.

Only exception: the health controller, which pings the database for readiness and returns
no tenant data.

### R3 — Access is layered, and the layers are proportional

The shape is **controller → service → repository**. The third layer is optional: it appears
when it earns its place, not by default.

- A controller talks to a service, never to a repository.
- A service may query the database directly for a **simple** operation (see R4).
- When queries stop being simple, they move into a repository file for that feature.

Do not add a layer that only forwards arguments. A service that does nothing but call a
repository method is a pass-through layer and should be collapsed.

### R4 — Simple queries stay in the service; complex queries move to a repository

A query is **simple** — keep it inline in the service — when all of these hold:

- one table, at most one related record;
- no pagination, ordering or aggregate count;
- no reuse by another method;
- no public-facing projection;
- the service file is comfortably under 300 lines.

A query is **complex** — put it in `<feature>.repository.ts` — when any of these hold:

- it joins or aggregates more than one table;
- it paginates, sorts, or counts;
- it defines a projection consumed by a public endpoint;
- two or more methods need it;
- it mixes several operations that must stay consistent;
- the file would otherwise cross the limit.

The layer is what NestJS calls a **repository**. Earlier revisions of this document called
it a *model*; both names mean the same thing, and `repository` is the convention used here.
The file suffix is `.repository.ts`.

### R5 — One entry point for the generated database client

Application code MUST NOT import the generated client or the vendor package directly. Use
the single local re-export in the database layer.

### R6 — Configuration is injected, never read from the environment

Feature code MUST NOT read the environment directly. Inject the typed configuration object.
Only the configuration module, the seed script and the Prisma configuration file read the
environment.

### R7 — The tenant never comes from the client

The organisation id used for isolation is derived server-side from a verified membership, at
the route guard. A request body, query string or header must never be able to select a
tenant. Every tenant-owned query carries an explicit predicate.

### R8 — Secrets never enter the repository

No credentials, tokens or connection strings in tracked files. `.env` is ignored; only its
example file is committed, and it carries empty values.

### R9 — Shapes are shared, and validated at the boundary

Request and response shapes are declared once in the shared contracts workspace and reused
by both the API and the web client. Every route validates its input with the shared schema
before the service sees it.

### R10 — Modules import services, not internals

A module may use another module's service. It MUST NOT import another module's repository,
controller, or internal helper. Cross-cutting code lives in `common/`; the database layer is
global. Pure helpers used by several modules belong in `common/`, not in a feature service.

### R11 — Logic has a test, and every fix has a regression test

- New logic (rules, mapping, validation, state transitions, token or date handling) ships
  with a spec file beside it.
- Every bug fix ships with a test that **fails on the previous code** and passes after.
- Tests live next to the code: `<file>.spec.ts` (API and shared), `<Component>.test.tsx` or
  `.test.ts` (web).
- At least one test must exercise each documented rule that a machine can check; the
  conventions gate is itself tested.
- "I will add tests later" is not a completion state. If a rule is worth writing, it is
  worth one assertion.

### R12 — Every protected action has a capability

The capability registry in `packages/shared/src/platform/capability-definitions.ts` is the
single authorization model. No new functionality, endpoint or administrative operation
may be added without registering its capabilities and enforcing them.

- Every protected tenant route carries `@RequireCapability(...)`; platform routes use a
  `scope: 'platform'` capability.
- The route catalogue records the same capability. `routes.spec.ts` fails on a missing
  capability or a mismatch.
- Services call `CapabilitiesService.requireCapability` only when a check cannot live at
  the route; they do not compare permission strings by hand.
- Frontend controls derive from the effective set the API returns, never from a locally
  invented list.
- New capability definitions include dependencies, scope and legacy-permission mapping,
  and ship with tests.

See `16-capability-authorization.md` for the evaluation rule and the full checklist.
Do not introduce an independent permission mechanism.

---

# Part B — The 300-line rule in practice

### Why

A file that no longer fits on one screen usually holds more than one responsibility, and it
makes tenant predicates easy to miss during review.

### Counting

Physical lines, including comments and blank lines, as reported by the conventions gate.

### Current exceptions

There are none. Both files that previously exceeded the limit were split:
`auth.service.ts` into session and registration services, and `events.service.ts` into a
service, a repository and a mapper.

The gate still supports an exception list, but it is empty and must stay empty. Adding an
entry is a decision to postpone a split, and it has to be argued in this document.

### How to split, in order of preference

1. **Extract a repository.** Move the complex query surface out (see R4). This is the most
   common cause of a fat service.
2. **Extract a responsibility.** Two services with names that describe one job
   (`SessionService`, `RegistrationService`) beat a private method pile.
3. **Extract pure functions.** Mapping, sorting and validation belong in a small file with
   no dependencies — and they become directly testable (R11).
4. **Extract a projection.** Public read models grow independently of the write path.

### What not to do

- Do not split by file position (`events.service.part2.ts`). Split by responsibility.
- Do not raise the limit to make a check pass. If 300 is genuinely wrong, argue it here.
- Do not move code into a new oversized file; the limit applies to the destination.

---

# Part C — The repository layer

### Responsibility

A repository is the only place allowed to express a **complex** query. It receives the
tenant-scoped transaction client and always includes the tenant predicate.

A repository:

- accepts the client as a parameter, never creates one;
- contains no business rules ("may this role publish?");
- throws no framework-specific error for a business case;
- returns plain records or projections, not HTTP objects.

A repository MUST NOT open its own transaction — the service owns the transaction boundary,
and a nested transaction breaks the tenant-context guarantee.

### Canonical shape

```
modules/events/
  events.module.ts           wiring
  events.controller.ts       HTTP: route in, one service call, response out
  events.service.ts          rules, transaction boundary, orchestration
  events.repository.ts       complex queries, tenant predicates, projections
  events.mapper.ts           pure row → contract mapping
  events.lifecycle.ts        pure state-transition rules
  events.service.spec.ts     behaviour tests
```

```ts
// events.repository.ts — the only place that expresses this query
@Injectable()
export class EventsRepository {
  list(tx: TenantPrismaClient, filter: ListFilter) {
    const where: Prisma.EventWhereInput = {
      organizationId: filter.organizationId,
      status: filter.status,
      visibility: filter.visibility,
      name: filter.search ? { contains: filter.search, mode: 'insensitive' } : undefined,
    };

    return Promise.all([
      tx.event.findMany({
        where,
        orderBy: filter.orderBy,
        skip: filter.skip,
        take: filter.take,
        include: { _count: { select: { editions: true } } },
      }),
      tx.event.count({ where }),
    ]);
  }
}
```

```ts
// events.service.ts — rules and orchestration, no query syntax
async list(query: ListEventsQuery): Promise<PaginatedResult<EventSummary>> {
  const tenant = this.tenantContext.require();
  const orderBy = buildOrderBy(query.sort); // pure, tested

  return this.tenantTransaction.withTenant(async (tx) => {
    const [rows, total] = await this.events.list(tx, {
      organizationId: tenant.organizationId,
      ...buildListFilter(query),
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return { items: rows.map(toSummary), page: query.page, pageSize: query.pageSize, total };
  });
}
```

### Where the line sits, concretely

| Operation | Where it lives |
| --- | --- |
| Fetch one event by id for the current tenant | Service (one table, one row) |
| List with search, status filter, sort, pagination and a count | Repository |
| Public event context with organisation, branding and locale | Repository + mapper |
| Publish: read status, decide transition, update | Service rules + repository writes |
| Load memberships for the signed-in account | Service (one query, reused inside the same class) |

---

# Part D — Structure and naming

1. Folders are plural and feature-based: `modules/registrations/`.
2. One primary export per file, named after the file.
3. Fixed suffixes: `.module.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`,
   `.mapper.ts`, `.spec.ts`, `.tsx` for components. `routes.ts` is the per-module route
   catalogue; it has no runtime role and is checked by `common/routes/routes.spec.ts`.
4. No barrel files inside feature modules; they hide cycles and defeat the layer rules.
5. Pure helpers shared by two or more modules live in `common/utils/`.
6. Cross-cutting concerns go in `common/`: guards, decorators, interceptors, filters, pipes.
7. A module may export its service. It should not export its repository or mapper.

---

# Part E — API surface

1. Every response is wrapped by the global envelope. Do not build envelopes by hand.
2. Errors are thrown as the application's error type with a stable code.
3. Validation happens before the service, through the shared schema.
4. Public endpoints are explicitly marked public and return projections containing no
   internal ids, members, contacts or unpublished records.
5. State-changing routes are tenant-scoped and capability-checked at the route.
6. Pagination follows `07-api-conventions.md` consistently.
7. Every controller route has an entry in its module's `routes.ts`; the route catalogue
   test fails when the catalogue and the decorator metadata disagree. See
   `15-route-catalogue.md`.

---

# Part F — Frontend

1. Features live under `features/<feature>/` with `pages/`, `components/` and hooks.
2. Screens do not call the network directly; they use the service layer.
3. Shared shapes come from the contracts workspace — never redeclare a response type.
4. No user-facing string in business logic. Locale files only, French and English.
5. Branding comes from the resolved workspace context, never hardcoded colours.
6. Components stay under 300 lines; extract subcomponents instead of nesting deeper.

---

# Part G — Testing

### What must be tested

| Kind | Required when | Example |
| --- | --- | --- |
| Unit — logic | Any rule, mapping, sort whitelist, state transition, token or date handling | Publish refused for a cancelled event |
| Unit — projection | A mapper shapes a contract consumed elsewhere | Branding row → contract object |
| Regression | Every bug fix | A repository error is reported as a clear unavailability, not a generic failure |
| Rules | The conventions gate changes | An oversized fixture file is rejected |
| Isolation | A new tenant-owned query path exists | Tenant A cannot read tenant B's row |

### How tests are written here

1. One spec file beside the unit under test.
2. Assert observable outcomes, not call sequences.
3. Unit tests do not touch the database. Use a fake repository or an in-memory double.
4. Tests must not depend on ambient configuration; set what they need locally.
5. Provider-wiring tests are not used yet: the test transpiler does not emit decorator
   metadata, so a Nest module cannot be constructed as the application does. Until that
   changes, test the logic the providers call. This is a known gap, recorded in
   `12-dependency-and-security.md`.

---

# Part H — Dependencies and security

1. Never run `npm audit fix` without inspecting it. It downgrades. Never run `--force`.
2. The database client and its command-line tool stay pinned to the same exact version.
3. No new dependency without a sentence in the commit message saying what it replaces or
   why the platform cannot do it.
4. Prefer an existing dependency over a new one, and the standard library over both.
5. The audit posture and deferred migrations live in `12-dependency-and-security.md`.

---

# Part I — Commits and documentation

1. Commits follow `type(scope): summary` — `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.
2. A commit that changes behaviour also updates the document that describes it.
3. Migrations are committed with the schema change that produced them.
4. Do not commit generated output, build artefacts, environment files or lockfile edits you
   did not intend.

---

# Part J — Definition of done

```sh
npm run check:conventions   # rules a machine can decide
npm run test                # runs the rules test, then API and web suites
npm run typecheck           # all three workspaces
npm run build               # server and site actually compile
```

For anything touching data access, also verify by hand:

- the new query carries the tenant predicate;
- no controller or component gained a database import;
- no file crossed 300 lines;
- a fresh copy still generates the database client without a configured environment.

Then state, in the final message, which of those checks was actually run — not which ones
"should" pass.

---

## Rule index

| Rule | Subject |
| --- | --- |
| R1 | 300-line file limit |
| R2 | Controllers never touch the database |
| R3 | Proportionate layering: controller → service → repository |
| R4 | Simple queries inline, complex queries in a repository |
| R5 | Single entry point for the generated client |
| R6 | Configuration is injected, not read from the environment |
| R7 | Tenant identity is derived server-side |
| R8 | No secrets in the repository |
| R9 | Shared, validated contracts |
| R10 | Modules import services only |
| R11 | Logic tested, fixes regression-tested, rules machine-tested |
| R12 | Every protected action has a registered, enforced capability |
