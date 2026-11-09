# 12 — Dependency and security policy

## Policy

1. **Never run `npm audit fix` on this tree without `--dry-run` first.**
   It performs *downgrades* to escape advisory ranges. Observed: it moved `prisma`
   `6.19.3 → 6.12.0` because the `deepmerge-ts` advisory starts at `6.13.0-dev.1`,
   leaving the Prisma CLI out of step with `@prisma/client`.
2. **Never run `npm audit fix --force`.** Nest packages version-lock together; forcing
   `@nestjs/core` to a new major while the surrounding family stays behind produces a
   server that boots and misbehaves.
3. **Assess exposure before urgency.** A finding in Swagger, the Prisma CLI or the test
   runner is not the same as one in request parsing.
4. `prisma` and `@prisma/client` are **pinned to the same exact version**. They must
   never drift.

## Current posture

After the Nest 12 / TypeScript 6 / Prisma 7 migration, `npm audit` reports **0
vulnerabilities** on the installed tree. The table below is kept as the decision record for
the advisories that drove each upgrade, not as a live inventory.

| Advisory group | Reaches production? | Where it lives | Action |
| --- | --- | --- | --- |
| `@nestjs/common` Content-Type RCE (`<10.4.16`) | Yes | framework | **Cleared by Nest 11** |
| `@nestjs/core` injection (`<=11.1.17`) | Yes | framework | **Cleared by Nest 11** |
| `@nestjs/platform-express` (`<=11.1.14`) | Yes | framework | **Cleared by Nest 11** |
| `body-parser` DoS (`<=1.20.8`) | Yes | Express 4 chain | **Cleared** — Nest 11 uses Express 5 / body-parser 2 |
| `multer` DoS (`<=2.4.0`) | Only once uploads exist | platform-express | **Cleared by Nest 11** |
| `file-type` (`@nestjs/common` 10.4.16–10.4.22) | Low — no validator used | framework | **Cleared by Nest 11** |
| `zod` memory exhaustion (`<4.6.6`) | **Was real** — validates every body | `packages/shared` contracts | **Migrated to Zod 4.6.7** |
| `qs` DoS | Yes | Express query parsing | In-range patch (`npm audit fix` handles this one only) |
| `react-router` open redirect / SSR injection (`<=7.17.0`) | Low — no SSR, no user-controlled navigation | web router | **Migrated to 7.18.5** |
| `js-yaml`, `lodash` | **No** — Swagger is only mounted when `NODE_ENV !== 'production'` | `@nestjs/swagger`, `@nestjs/config` | Re-check after Nest 11; otherwise accepted |
| `deepmerge-ts` (Prisma CLI) | No — dev tooling | `prisma` | Accepted; do **not** let audit fix it |
| `vitest` / `@vitest/mocker` / `tinypool` (critical) | No — test runner only | web devDependencies | **Upgraded to Vitest 5** |
| `ajv`, `webpack`, `glob`, `minimatch`, `picomatch`, `tmp`, `deepmerge` | No — build tooling | `@nestjs/cli` only (Jest removed) | Deferred with the CLI upgrade |

## Applied

### Nest 10 → 11 (Express 5)

`@nestjs/{common,core,platform-express}` `^11.0.0`, `@nestjs/config` `^4.0.0`,
`@nestjs/jwt` `^11.0.0`, `@nestjs/swagger` `^11.0.0`, `@nestjs/cli`/`schematics`/
`testing` `^11.0.0`, `@types/express` `^5.0.0`.

Code change required: Nest 11 uses path-to-regexp v8, where a bare `*` is invalid.
`app.module.ts` registers the request-id middleware with `forRoutes('{*splat}')`.

This clears every framework-level finding in the table above, including the
`body-parser`/`multer` pair, because Express 5 brings body-parser 2 and a patched multer.

**Verified after upgrading:** `@nestjs/common`, `core`, `platform-express` and `testing`
at `11.2.9`; `config` at `4.0.4`; `jwt` at `11.0.2`; `swagger` at `11.4.8`.

**A major upgrade can leave a nested copy behind.** Immediately after the Nest 11
install, `npm ls @nestjs/common` still showed a leftover `10.4.15` under
`@nestjs/config` and `@nestjs/jwt`, and that single stale copy kept the Content-Type
advisory in the audit report even though the framework had been upgraded. Always check
after bumping a framework family:

```sh
npm ls @nestjs/common          # must show one version, no 10.x line
npm dedupe                     # prune residue before reaching for overrides
npm why @nestjs/common         # only if a second copy survives
```

### Prisma version pin

`prisma` and `@prisma/client` are both pinned to `6.19.3` (exact, no caret) so the CLI and
the generated client cannot drift. The `deepmerge-ts` finding is accepted: it is reachable
only through the Prisma CLI at build time, never at runtime.

The `prisma` key in `package.json` has been retired in favour of `apps/api/prisma.config.ts`
(Prisma 6.16+; required by 7). Note the associated trap: once that file exists the CLI
stops loading `.env` on its own, so the config imports `dotenv/config`. `dotenv` is a
regular dependency, not a dev dependency, because a production image that runs
`prisma migrate deploy` with dev dependencies omitted still needs it.

Prisma 7 remains deferred for the `deepmerge-ts` finding, and the upgrade is larger than a
version bump:

| Change | Impact on this repository |
| --- | --- |
| Prisma ships as **ESM**; `"type": "module"` expected | The API is CommonJS today. Consuming ESM from CJS relies on `require(esm)` (Node ≥ 20.19) and is outside the supported path; the documented route is converting the app to ESM |
| `prisma-client-js` is on the way out; `prisma-client` requires an **`output` path** | Generated client moves out of `node_modules/@prisma/client`; every import of the client changes (8 files) |
| A **driver adapter** is required | `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`; `PrismaService` must be rebuilt around `@prisma/adapter-pg` and the configured URL |
| `url`/`directUrl` move to `prisma.config.ts` | Config gains a `datasource` block |
| `migrate dev` no longer generates or seeds automatically | `db:migrate` must run `prisma generate` after migrating; seeding stays explicit (`prisma db seed`) |
| SSL certificates are validated strictly (node-postgres) | Supabase connections may need `ssl: { rejectUnauthorized: false }` or a configured CA |

Prerequisites are satisfied (Node 22, TypeScript 5.7 ≥ 5.4), but the ESM requirement is the
blocker: it is an application-wide change, not a dependency change.

### Zod 3 → 4

`zod` is `^4.6.7` in `packages/shared`, `apps/api` and `apps/web`;
`@hookform/resolvers` moved to `^5.0.0` (v3 targets Zod 3).

Constructs migrated:

| Zod 3 | Zod 4 |
| --- | --- |
| `z.string().email()` | `z.email()` |
| `z.string().url()` | `z.url()` |
| `z.string().uuid()` | `z.uuid()` |
| `z.string().datetime({ offset: true })` | `z.iso.datetime({ offset: true })` |
| `.refine(...).innerType().partial()` | separate base object, then `.partial()` |
| `z.ZodTypeAny`, `z.ZodIssueCode`, `z.ZodIssue` | `z.ZodType`, plus a local `ModuleSettingsIssue` shape |

The `ZodValidationPipe` now takes `ZodType<T>` (Zod 4 dropped the three-generic
signature). Email normalisation uses `.pipe(z.email(...))` so trimming happens before
validation instead of after.

### React Router 6 → 7

`react-router-dom` is `^7.18.5`. The router APIs in use (`createBrowserRouter`,
`RouterProvider`, `NavLink`, `Outlet`, `useOutletContext`, `Navigate`) exist unchanged in
v7, so no imports moved.

### Vitest 5, and Jest removed from the API

Vitest is `^5.1.0`, which clears the critical `tinypool` gadget and the `@vitest/mocker`
findings. It requires Vite 7, so the web app moved to `^7.0.0`.

The API now runs on the same runner as the web app. `jest`, `ts-jest`, `@types/jest`,
`jest.config.js` and the Jest E2E config are gone, which removes `deepmerge`, `glob`,
`minimatch`, `test-exclude`, `babel-plugin-istanbul` and the `@jest/*` packages from the
install.

Caveat to remember: Vitest transpiles with esbuild, which does not emit decorator
metadata. Pure unit tests are unaffected. The first test that instantiates a Nest provider
through dependency injection needs the SWC plugin (`unplugin-swc`); add it when that test
appears, not before.

## Deferred, with reasons

### `@nestjs/cli` 11 → 12 (and the Nest 12 family)

12 is **newer** than 11. It clears the build-tool findings (`ajv`, `webpack`, `glob`,
`minimatch`, `picomatch`, `tmp`, `deepmerge`), none of which carry runtime exposure.

The upgrade is bigger than the CLI alone:

- All Nest 12 packages ship as **ESM**. A CommonJS app still runs, via `require(esm)`,
  which requires **Node ≥ 20.19 / ≥ 22.12**.
- `@nestjs/schematics` v12 requires **TypeScript 6** as a peer. Upgrading the CLI therefore
  drags TypeScript 6 across both workspaces.
- The CLI's own generators need Node ≥ 22.22.3 (or 24.15+/26+).
- `nest upgrade` performs most of the mechanical work and prints what it cannot migrate.

Code touchpoints in this repository: custom pipe signatures (`ArgumentMetadata` is now
generic), lifecycle-hook ordering, and the config module's shift to Standard Schema. Nest 12
also adds `StandardSchemaValidationPipe`, which would let us delete the hand-written Zod
pipe entirely — still a worthwhile follow-up.

### Nest 12 + TypeScript 6 + Prisma 7 (applied)

All three moved together, because each one blocks the others:

- **`@nestjs/cli` 12 pins `typescript ~6.0.2`** and `@nestjs/schematics` 12 declares
  `typescript >=6.0.0`. The coherent TypeScript target is therefore **6.0.3**, not 7.
- **TypeScript 7 is not adoptable yet.** 7.0 ships *no compiler API* (that is announced for
  7.1), so `ts-node` and any tool that drives the compiler cannot use it, and
  `@nestjs/swagger` 12's peer range is `^5.5.0 || ^6.0.0`. Revisit after 7.1.
- **TypeScript 6 turned old defaults into errors.** Fixed in-tree: `moduleResolution:
  node10` → `nodenext` (API) / `node16` (shared), `baseUrl` removed (it is now unsupported),
  and `rootDir` set explicitly in `tsconfig.build.json` (`./src`) since it no longer defaults
  from the common source directory.
- **Nest 12 packages are ESM-only.** A CommonJS API still works at runtime through
  `require(esm)` on Node ≥ 22.12, and `module: nodenext` lets TypeScript type those imports.
  This is why the API did **not** need converting to ESM.
- **Prisma 7 is stable; Prisma 8 is not.** `@prisma/client` has no 8.x release at all (only
  `8.1.0-dev.*`), while the `prisma` CLI's `latest` tag points at an RC. Installing
  `prisma@latest` would therefore produce a CLI with no matching client. Pinned to the
  stable pair **7.10.1**.

Prisma 7 changes that are now part of the codebase:

- The client is generated as **source** into `src/generated/prisma` by the `prisma-client`
  generator; imports go through `src/database/prisma-client.ts` rather than `@prisma/client`.
- Generated with `moduleFormat = "cjs"` and `importFileExtension = ""`, so the client stays
  resolvable both from compiled output and from TypeScript source (seed, tests).
- Every client is built from a driver adapter: `@prisma/adapter-pg` over `pg`.
- The connection string lives in `prisma.config.ts`; `url` in the datasource block is rejected.
- `migrate dev` no longer generates and no longer seeds automatically — the npm scripts run
  `prisma generate` explicitly.

**Supabase TLS note:** `pg` ≥ 8.23 treats `sslmode=require` as `verify-full`, and the pooler's
certificate chain is not trusted by Node, which surfaces as
`Error opening a TLS connection: self-signed certificate in certificate chain`. The URL
therefore uses `sslmode=no-verify` (encrypted, chain not validated).

Result: `npm audit` reports **0 vulnerabilities** on the installed tree.

### Test-harness gap: provider wiring

The API test runner transpiles with esbuild, which does **not** emit decorator metadata, so a
test cannot construct a Nest module the way the application does. Consequences:

- Dependency-injection regressions (a constructor parameter whose type only exists at design
time) are not caught by `npm run test`.
- They are caught by booting the built server and calling the readiness route, which is part
of the definition of done in `13-coding-rules.md`.
- Logic is tested directly through pure functions, which is why mapping, query shaping and
error normalisation were extracted into their own files.

Closing the gap means adding the SWC plugin to the API test config. Not done yet: it is a new
build dependency, and the current split covers the logic.

## Still open: connection-string and lockfile traps

- **Use the Supabase Session pooler**, not `db.<ref>.supabase.co` (IPv6-only).
- A previously committed lockfile recorded `cors` without an `object-assign` entry, so
  `npm ci` produced a tree where the API could not load its HTTP driver. Regenerating the
  lockfile was the fix; if `npm ci` ever yields `Cannot find module 'object-assign'`, treat
  the lockfile as corrupt rather than debugging the app.
- An incremental build can replay diagnostics from a stale `.tsbuildinfo`. Delete it before
  concluding that a config change did not help.

## How to re-check

```sh
npm ls @nestjs/common @nestjs/core @nestjs/platform-express @prisma/client prisma
npm audit --omit=dev          # production exposure
npm audit                     # full tree, and read the parents before acting
npm audit fix --dry-run       # inspect what it *would* change — especially downgrades
```

The `npm ls` line matters: a mismatch between `prisma` and `@prisma/client` or between
Nest packages is a bug in its own right, independent of any CVE score.

## Re-review triggers

- Before any deployment that accepts public traffic.
- Before the registration endpoints ship (Zod).
- When the file-upload/storage adapter lands (multer exposure becomes real).
- Any time `npm audit` reports a *critical* in a package that runs server-side.
