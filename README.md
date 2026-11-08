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
repository root (`*.docx`, `*.pdf`, `extracted.txt`) for traceability.

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

```sh
npm install
cp apps/api/.env.example apps/api/.env     # fill in DATABASE_URL and secrets
npm run build -w @event-platform/shared    # contracts are consumed as compiled output
npm run db:generate                        # prisma client
npm run db:migrate                         # apply migrations (needs a database)
npm run dev                                # api on :4000, web on :5173
```

The API serves Swagger at `http://localhost:4000/api/docs` and a health probe at
`GET /api/v1/health`. The web app resolves the API base URL from `VITE_API_URL`.

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
