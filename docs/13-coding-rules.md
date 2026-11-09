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
| Machine-checked | `npm run check:conventions` — file size, controller/data-layer separation, single database client entry point, environment access |
| Type-checked | `npm run typecheck` across all three workspaces |
| Reviewed | Everything else in this document |
| Blocking | Nothing merges with a failing check, a failing test, or a rule broken without a recorded reason |

`npm run lint` runs the conventions gate first, then the workspaces' type checks.

---

# Part A — Hard rules

Every rule in this part is a blocker.

### R1 — No source file over 300 lines

No new file may exceed **300 lines**. Files between 270 and 300 are a warning: split before
adding. Files already over the limit are listed in Part B and may only shrink.

Applies to `.ts` and `.tsx` under `apps/api/src`, `apps/web/src`, `packages/shared/src`.
Generated code, migrations and build output are excluded.

### R2 — A controller never touches the database

Controllers read the request, call exactly one service method, and return. They MUST NOT
import the database layer, hold a client, or contain business branching.

Only exception: the health controller, which pings the database for readiness and returns
no tenant data.

### R3 — Layers are controller → service → model

Every feature that reads or writes data is split into those three files. No layer may skip
downward or reach back up.

### R4 — Only the model layer issues queries

Queries, projections and raw SQL live in a model file. Services decide *what* should happen;
models decide *how* it is fetched or stored.

### R5 — One entry point for the generated database client

Application code MUST NOT import the generated client or the vendor package directly. Use
the single local re-export in the database layer. This keeps a generator change a one-file
edit.

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

A module may use another module's service. It MUST NOT import another module's model,
controller, or module-internal helper. Cross-cutting code lives in `common/`; the database
layer is global.

---

# Part B — The 300-line rule in practice

### Why

A file that no longer fits on one screen hides two problems: it usually holds more than one
responsibility, and it makes tenant predicates easy to miss during review.

### Counting

Physical lines, including comments and blank lines, as reported by the conventions gate.
Generated code and declarations are excluded.

### Current exceptions

These exceed the limit and are on a **shrink list**. They may only get smaller; adding
behaviour to them is a review failure.

| File | Lines | Expected split |
| --- | --- | --- |
| `apps/api/src/modules/auth/auth.service.ts` | 529 | registration/verification, session lifecycle, password reset |
| `apps/api/src/modules/events/events.service.ts` | 357 | event CRUD, lifecycle/publishing, public projections |

### How to split, in order of preference

1. **Extract a layer.** Move queries into the module's model file. This is the most common
   cause of a fat service.
2. **Extract a collaborator.** A second service with a name that describes one job
   (`SessionRotation`, `BrandingResolution`) beats a private method pile.
3. **Extract pure functions.** Validation, mapping and formatting belong in small modules
   with no dependencies.
4. **Extract a projection.** Public read models get their own file; they usually grow
   independently of the write path.

### What not to do

- Do not split by file position (`events.service.part2.ts`). Split by responsibility.
- Do not raise the limit to make a check pass. If 300 is genuinely wrong, argue it in this
  document first.
- Do not move code into a new oversized file. The limit applies to the destination too.

---

# Part C — The model layer

### Responsibility

The model layer is the only code that talks to PostgreSQL. It is what
`08-backend-architecture.md` means by "data access"; the earlier name "repository" refers to
this same layer.

A model file:

- receives a **tenant-scoped transaction client** (or, for pre-tenant lookups, the plain
  client with a stated reason);
- always includes the tenant predicate on tenant-owned rows;
- returns plain objects or domain-shaped records, never framework objects;
- contains no HTTP concern, no status code, no request object.

A model file MUST NOT:

- set tenant context (that is the transaction service's single job);
- decide business rules ("may this role publish?");
- throw HTTP-shaped errors;
- be imported by a controller or by another module.

### Transition state

The modules that exist today still query from their services: the model layer has not been
extracted yet for auth, events or workspaces. That is not permission to keep doing it. When
a module is next touched, move its queries into the module's model file **in the same
change**, and never add a new query to a service. The oversized services in Part B are the
first candidates, because they must shrink anyway.

### Canonical shape

```
modules/events/
  events.module.ts       wiring: imports/exports only
  events.controller.ts   HTTP: route in, one service call, response out
  events.service.ts      rules, transactions, audit
  events.model.ts        queries, tenant predicates, projections
  dto/                   shared schema re-exports + documentation metadata
  events.service.spec.ts unit tests
```

```ts
// events.model.ts — the only place that knows how events are stored
@Injectable()
export class EventsModel {
  constructor(private readonly prisma: PrismaService) {}

  findMany(tx: TenantPrismaClient, filter: { organizationId: string; status?: EventStatus }) {
    return tx.event.findMany({
      where: { organizationId: filter.organizationId, status: filter.status },
      orderBy: { startsAt: 'desc' },
    });
  }
}
```

```ts
// events.service.ts — rules and transaction boundary, no query syntax
async list(filter: ListEventsInput): Promise<EventSummary[]> {
  const context = this.tenantContext.require();
  return this.tenantTransaction.withTenant(async (tx) => {
    const rows = await this.events.findMany(tx, { organizationId: context.organizationId });
    return rows.map(toEventSummary);
  });
}
```

### Transactions belong to the service

The service opens the transaction and passes the scoped client down. A model must never open
its own transaction: nested transactions break the tenant context guarantee.

---

# Part D — Structure and naming

1. Folders are plural and feature-based: `modules/registrations/`, not `modules/registration-logic/`.
2. One primary export per file, named after the file.
3. File suffixes are fixed: `.module.ts`, `.controller.ts`, `.service.ts`, `.model.ts`,
   `.spec.ts`, `.tsx` for components.
4. No barrel files inside feature modules. They hide cycles and defeat the layer rules.
5. Public read models live next to the module that owns them, not in `common/`.
6. Cross-cutting concerns go in `common/`: guards, decorators, interceptors, filters, pipes.
7. Nothing outside `common/`, `config/` and `database/` may be imported by more than one
   module without becoming its own module.

---

# Part E — API surface

1. Every response is wrapped by the global envelope. Do not build envelopes by hand.
2. Errors are thrown as the application's error type with a stable code. Do not return
   ad-hoc objects with status fields.
3. Validation happens before the service: route input goes through the shared schema.
4. Public endpoints are explicitly marked public and return projections that contain no
   internal ids, members, contacts or unpublished records.
5. Anything that changes state is scoped to a tenant and permission-checked at the route.
6. Pagination is cursor- or page-based consistently, following `07-api-conventions.md`.

---

# Part F — Frontend

1. Features live under `features/<feature>/` with `pages/`, `components/` and hooks.
2. Screens do not call the network directly; they use the service layer.
3. Shared shapes come from the contracts workspace — never redeclare a response type.
4. No user-facing string in business logic. Locale files only, French and English.
5. Branding comes from the resolved workspace context, never from hardcoded colours.
6. Components stay under 300 lines too; extract subcomponents instead of nesting deeper.

---

# Part G — Testing

1. One test file beside the unit under test, named `.spec.ts` (or `.test.ts` for components).
2. Test behaviour, not implementation: assert observable outcomes.
3. Unit tests do not touch the database. Use a fake model or an in-memory double.
4. Isolation tests are separate and explicit: two tenants, assert the second cannot read the
   first.
5. Every bug fix gets a test that fails before the fix.

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
2. A commit that changes behaviour also updates the document that describes that behaviour.
3. Migrations are committed with the schema change that produced them, never afterwards.
4. Do not commit generated output, build artefacts, environment files or lockfile edits you
   did not intend.

---

# Part J — Definition of done

Run these before calling work finished:

```sh
npm run check:conventions   # rules in this document that a machine can decide
npm run typecheck           # all three workspaces
npm run test                # API and web suites
npm run build               # server and site actually compile
```

For anything touching data access, also verify by hand:

- the new query carries the tenant predicate;
- no controller or component gained a database import;
- no file crossed 300 lines;
- a fresh copy of the project still generates the database client without a configured
  environment.

Then state, in the final message, which of those checks was actually run — not which ones
"should" pass.

---

## Rule index

| Rule | Subject |
| --- | --- |
| R1 | 300-line file limit |
| R2 | Controllers never touch the database |
| R3 | Controller → service → model layering |
| R4 | Only the model layer issues queries |
| R5 | Single entry point for the generated client |
| R6 | Configuration is injected, not read from the environment |
| R7 | Tenant identity is derived server-side |
| R8 | No secrets in the repository |
| R9 | Shared, validated contracts |
| R10 | Modules import services only |
