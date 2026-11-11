# 18 — Deployment and operations

Target: one API process (plus optional worker), one static web build, PostgreSQL on
Supabase (database only), Redis, an S3-compatible bucket and an e-mail provider.

## 1. Database (Supabase)

1. Use the **Session pooler** host and `sslmode=no-verify` (see `AGENTS.md`).
2. As the **owner** role, apply the schema and reference data:

   ```sh
   DATABASE_URL='<owner url>' npm run db:deploy
   ```

   This also inserts the permission catalogue (migration `seed_permission_catalogue`,
   idempotent, applied by `db:deploy`).
3. Create the **runtime role** once (never owner, never `BYPASSRLS`):

   ```sql
   CREATE ROLE platform_app LOGIN PASSWORD '<generated>';
   GRANT CONNECT ON DATABASE postgres TO platform_app;
   GRANT USAGE ON SCHEMA public TO platform_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO platform_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO platform_app;
   ```
4. Apply the row-level security policies **after every migration that adds a tenant table**:

   ```sh
   psql "<owner url>" -f apps/api/prisma/policies/tenant-rls.sql
   ```

   The file is idempotent. The tenant isolation spec fails if a table was forgotten.
5. The API's `DATABASE_URL` is the **`platform_app`** URL. Never run the API as the owner:
   owners bypass RLS and silently disable the second isolation layer.

## 2. Configuration

Everything is validated at boot; a missing value stops the process with a list of problems.
See `apps/api/.env.example`. Production essentials:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | `platform_app` pooler URL |
| `JWT_ACCESS_SECRET` | ≥ 32 chars; also derives the MFA encryption key and (unless set) the badge key |
| `BADGE_SIGNING_SECRET` | Set explicitly in production; rotating it invalidates all issued badges |
| `WEB_APP_URL`, `CORS_ORIGINS` | The public web origin |
| `TRUST_PROXY` | Number of reverse-proxy hops (1 behind a single load balancer); required for correct per-IP rate limits |
| `REDIS_URL` | Enables durable queued e-mail and export jobs; without it both run in-process |
| `JOBS_WORKER_ENABLED` | `false` on API-only instances when a separate worker runs |
| `EMAIL_PROVIDER`, `EMAIL_FROM` | **Only the console adapter is implemented today**: nothing is sent externally until a provider adapter is added (`17-implementation-status.md`) |
| `STORAGE_PROVIDER`, `S3_*` | **Only the console adapter is implemented today**: uploaded logos are not persisted externally until an S3 adapter is added |
| `RATE_LIMIT_DEFAULT_LIMIT`, `RATE_LIMIT_DEFAULT_WINDOW_SECONDS` | Fallback only; production routes carry explicit budgets |
| `RATE_LIMIT_RETENTION_HOURS` | How long fixed-window counters are kept; default 48 |

Never put any of these in the web build: the browser only knows the API origin.

## 3. Processes

- **API**: `node apps/api/dist/main.js` (build with `npm run build`). Health:
  `/api/v1/health` (liveness), `/api/v1/health/ready` (database).
- **Workers** run inside the API by default. To scale: run API instances with
  `JOBS_WORKER_ENABLED=false` and one or two worker instances with it `true`. Mail and export
  jobs are claimed durably, so several workers do not duplicate them.
- **Web**: `npm run build -w @event-platform/web`, serve `apps/web/dist` as static files with
  an SPA fallback to `index.html`. Serve `/sw.js` with `Cache-Control: no-cache`. Do **not**
  cache `/api/` at the CDN.
- Terminate TLS in front; the API sets secure cookies in production.

## 4. First start

```sh
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='…' npm run db:seed
```

creates the first platform administrator. Turn on two-factor authentication for that
account straight away (`/account/security`).

## 5. Backups and recovery

- Enable Supabase point-in-time recovery or daily backups; note the retention window.
- **Drill before the beta** (quality gate E8.4): restore the latest backup into a scratch
  project, point a staging API at it, and run the journey specs. Record the time it took.
- Redis holds only transient jobs (queued e-mails, schedules). Losing it loses pending
  e-mails, not data; accounts and registrations live in PostgreSQL.
- Uploaded images live in the bucket; enable versioning or replication there.

## 6. Security checklist before go-live

- [ ] API connects as `platform_app`; `\du` shows no `BYPASSRLS`, not owner.
- [ ] `tenant-rls.sql` applied after the last migration; isolation spec green against staging.
- [ ] Rate limits on, `TRUST_PROXY` correct (test: repeated bad logins return 429).
- [ ] HTTPS everywhere; `Secure` cookies; CORS limited to the web origin.
- [ ] Secrets only in the host's secret store; none in the repository or the web build.
- [ ] `npm audit` reviewed (never `npm audit fix`, see `AGENTS.md`).
- [ ] Platform administrators have two-factor authentication on.
- [ ] Retention period decided and configured (`11-open-decisions.md`, D2).
- [ ] Backup restore drill done.

## 7. Routine operations

- **Suspend a workspace**: Super Admin console (`/platform`).
- **Erase a person**: registrations tab → Erase.
- **A participant lost their badge**: registrations tab → open the registration → Reissue badge (shows the code once; the old badge stops working).
- **A participant asks for their data or erasure**: they can do it themselves from the `/participant` link in their badge e-mail (My data). Staff can also erase from the registrations tab.
- **Purging expired personal data**: Data retention (workspace menu) → set the months, Preview, then Erase now. It is manual; schedule a reminder after each event.
- **Real e-mail / storage**: set `EMAIL_PROVIDER=resend` with `RESEND_API_KEY`, `STORAGE_PROVIDER=s3` with the `S3_*` variables and `S3_PUBLIC_BASE_URL`. Send a test registration and check the badge e-mail and a logo upload before the beta.
- **Audit**: workspace → Audit log.

## 8. Local development

```sh
npm run local:setup     # Docker Postgres + Redis, migrations, RLS, runtime role, apps/api/.env
npm run dev             # API :4000, web :5173
npm run local:reset     # wipe and rebuild the local database
```
