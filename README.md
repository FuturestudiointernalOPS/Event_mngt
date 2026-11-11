# Event Platform

Multi-tenant, white-label Event Management SaaS owned by Future Studio.
Innovation Village (Cotonou) is the first beta customer — not the product boundary.

> One platform. Multiple organisations. Independent workspaces. Configurable events.

## Repository layout

```
apps/
  api/        NestJS modular monolith (the only API the browser may call)
  web/        React + TypeScript + Vite single deployment for all tenants
packages/
  shared/     Contracts (Zod schemas), platform permissions and module registry
docs/         Consolidated architecture and delivery documentation
```

## Documentation

Start at [`docs/README.md`](docs/README.md). The raw source documents are kept in the
repository root (`*.docx`, `*.pdf`) for traceability.

Recommended reading order:

1. `docs/00-product-scope.md`
2. `docs/01-system-architecture.md`
3. `docs/02-data-model-and-erd.md`
4. `docs/03-tenant-isolation-and-rls.md`
5. `docs/04-authentication-and-sessions.md`
6. `docs/05-branding-and-theming.md`
7. `docs/06-module-registry.md`
8. `docs/07-api-conventions.md`
9. `docs/08-backend-architecture.md`
10. `docs/09-frontend-architecture.md`
11. `docs/10-roadmap-and-backlog.md`
12. `docs/11-open-decisions.md`

## Non-negotiables

- **Supabase is database hosting only.** No Supabase Auth, Storage, Edge Functions,
  Realtime, browser/client libraries or Supabase-as-API.
- **The browser talks to NestJS only.** No database access from the frontend.
- **Tenant isolation is enforced twice**: in the API (authorisation + explicit tenant
  predicates) and in PostgreSQL (row-level security).
- **One deployment for all organisations.** Branding is data, not a build artefact.
- **Modules are configuration, not code branches per customer.**

## Getting started

Run every command from the repository root. `@event-platform/shared` is a local
workspace package, not something published to npm.

```sh
npm install                                # installs all three workspaces
cp apps/api/.env.example apps/api/.env     # then fill in DATABASE_URL
cp apps/web/.env.example apps/web/.env     # optional; defaults to :4000
openssl rand -base64 48                    # paste into JWT_ACCESS_SECRET
npm run build -w @event-platform/shared    # the API imports the compiled contracts
npm run db:generate                        # prisma client
npm run db:migrate                         # apply migrations (needs a database)
npm run db:seed                            # optional: permissions, demo workspace, admin
npm run dev                                # api on :4000, web on :5173
```

`db:seed` creates the permission catalogue and the `innovation-village` workspace. Set
`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` to also create a platform admin account:

```sh
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='a-long-password' npm run db:seed
```

After the migration that creates the tables, apply row-level security as the migration
owner and point the API at the non-owner role:

```sh
psql "$DATABASE_URL" -f apps/api/prisma/policies/tenant-rls.sql
```

The API serves Swagger at `http://localhost:4000/api/docs` and a health probe at
`GET /api/v1/health`. The web app resolves the API base URL from `VITE_API_URL`.

The web app consumes `@event-platform/shared` **from source** (Vite alias plus a
tsconfig path), so `dev`, `build` and `test` there never depend on `packages/shared/dist`.
The API is compiled with `tsc`, so it does — that is what the shared build step above is for.
`npm run typecheck` builds it first for the same reason.

Run a single workspace's script with `-w`, for example `npm run test -w @event-platform/api`.

## Troubleshooting

**`npm error 404 ... GET https://registry.npmjs.org/@event-platform%2fshared`**

npm is resolving the shared package from the public registry because the install did not
see the workspace root. This happens when `npm install` is run inside `apps/api` or
`apps/web` instead of the repository root. Run it from the root:

```sh
cd event-platform-repo-root && npm install
```

To add a dependency to one workspace, still run from the root:

```sh
npm install <package> -w @event-platform/web
```

The workspace dependency is declared as `file:../../packages/shared` on purpose: it
resolves from the repository itself, so a stray install in a subfolder can never fall back
to the registry.

**`Cannot find module '@event-platform/shared'` for the API**

The API imports the compiled contracts. Run `npm run build -w @event-platform/shared`
(or `npm run dev` / `npm run typecheck`, which build it first). The web app is unaffected:
it reads the contracts from source.

**The API exits at boot with "Invalid environment configuration"**

The listed variables are missing or invalid. `JWT_ACCESS_SECRET` must be at least 32
characters; `DATABASE_URL` must be a PostgreSQL connection string.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | API and web in watch mode |
| `npm run build` | Build shared contracts, then api and web |
| `npm run typecheck` | TypeScript only, every workspace |
| `npm run lint` | Lint every workspace |
| `npm run test` | Unit tests for every workspace |
| `npm run db:migrate` | `prisma migrate dev` (api workspace) |
| `npm run db:deploy` | `prisma migrate deploy` in CI/production |
| `npm run db:studio` | Inspect the database |

## Status

Phase 1 (Foundation). The architecture, module boundaries, contracts and documentation
are in place; domain behaviour is implemented slice by slice following
`docs/10-roadmap-and-backlog.md`. See `docs/11-open-decisions.md` for what is still
unconfirmed.
