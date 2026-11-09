# Agent instructions

Multi-tenant, white-label event platform. One deployment, many organisations.
NestJS API + React web app + shared contracts in a single repository.

**Read first:** `docs/README.md` (decisions already made), then `docs/13-coding-rules.md`
(the binding rulebook). This file is the short version; the rulebook wins on detail.

## Non-negotiable rules

- **R1 — No file over 300 lines.** 270+ is a warning: split before adding. Never split by
  position (`part2`); split by responsibility.
- **R3/R4 — Controller → service → repository, proportionately.** Controllers never touch
  the database. A service may run a simple single-table query itself; when a query joins,
  paginates, sorts, aggregates, feeds a public projection or is reused, it moves to
  `<feature>.repository.ts`. Never add a layer that only forwards calls.
- **R5 — Import the database client from one local entry point**, never the generated path
  or the vendor package.
- **R6 — Inject typed configuration.** Never read the environment in feature code.
- **R7 — The tenant id comes from a verified membership server-side.** Never from a body,
  query or header. Every tenant-owned query carries the predicate.
- **R9 — Shapes live in the shared contracts package** and are validated at the route.
- **R10 — A module may import another module's service only** — not its repository,
  controller or internals.
- **R11 — New logic gets a spec; every bug fix gets a regression test** that fails on the
  old code. Tests sit beside the code.

## Where code goes

```
apps/api/src/modules/<feature>/
  <feature>.module.ts       wiring only
  <feature>.controller.ts   HTTP surface
  <feature>.service.ts      rules, transactions, audit
  <feature>.repository.ts   complex queries, tenant predicates, projections
  <feature>.mapper.ts       pure row -> contract mapping (when mapping is non-trivial)
  dto/                      shared schema re-exports
  <feature>.service.spec.ts behaviour tests
apps/api/src/common/        guards, decorators, pipes, filters, interceptors
apps/api/src/database/      the only place that constructs or re-exports the client
apps/api/src/config/        the only place that reads the environment
packages/shared/src/        contracts, permissions, module registry
apps/web/src/features/      one folder per feature: pages, components, hooks
```

If a feature needs three collaborators, give it three files — not one 700-line service.
Only add a repository when the query is complex, not by default.

## Testing is part of the work

- Rules, mapping, validation and state transitions get a spec beside them.
- Every bug fix gets a regression test that fails on the previous code.
- `npm run test` runs the rules check test first, then the API and web suites.

## Before you say you are done

```sh
npm run check:conventions   # file size, layering, env access, client imports
npm run test                # rules test, then API and web suites
npm run typecheck           # all workspaces
npm run build               # server and site
```

Report which of these actually ran. Do not claim a check passed without running it.

Also confirm by hand for data-touching work: tenant predicate present, no database import
in a controller or component, no file crossed 300 lines, and a test exists for the logic you
added.

## Traps that have already cost time

- **Never run `npm audit fix`** — it downgrades to escape advisory ranges. `--force` is
  never acceptable.
- The database client and its command-line tool are pinned to the same exact version.
- After any schema change: `npm run db:generate`. The generated client is gitignored and
  recreated on install; imports go through the local entry point.
- The Supabase connection must use the **pooler** host (the direct host is IPv6-only) and
  `sslmode=no-verify` (the pooler's certificate chain is not trusted by Node).
- A stale incremental build cache can replay errors that are already fixed. Delete the
  build cache before concluding that a config change failed.
- Do not enable the row-level isolation policy until membership lookup happens after tenant
  context exists. See `docs/03`.
