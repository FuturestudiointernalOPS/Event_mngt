#!/usr/bin/env node
/**
 * One-command local environment:
 *   npm run local:setup           first run: services, schema, RLS, runtime role, apps/api/.env
 *   npm run local:setup -- --reset  also drops and recreates the local database
 *
 * It never touches a remote database: every URL it writes points at the Docker services
 * defined in docker-compose.yml.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const api = join(root, 'apps', 'api');
const reset = process.argv.includes('--reset');
const OWNER_URL = 'postgresql://postgres:localdev@localhost:54329/eventplat';
const APP_URL = 'postgresql://platform_app:appdev@localhost:54329/eventplat';

const run = (cmd, args, options = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...options });
const psql = (sql, input) =>
  execFileSync('docker', ['exec', '-i', 'eventplat-pg', 'psql', '-U', 'postgres', '-d', 'eventplat', '-v', 'ON_ERROR_STOP=1', '-q', ...(sql ? ['-c', sql] : [])], {
    stdio: input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    input,
  });

console.log('→ starting Postgres and Redis');
run('docker', ['compose', 'up', '-d', '--wait']);

if (reset) {
  console.log('→ resetting the local database');
  execFileSync('docker', ['exec', 'eventplat-pg', 'psql', '-U', 'postgres', '-q', '-c', 'DROP DATABASE IF EXISTS eventplat WITH (FORCE)', '-c', 'CREATE DATABASE eventplat'], { stdio: 'inherit' });
}

console.log('→ applying migrations');
run('npx', ['prisma', 'migrate', 'deploy'], { cwd: api, env: { ...process.env, DATABASE_URL: OWNER_URL } });

console.log('→ runtime role and row-level security');
psql(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='platform_app') THEN CREATE ROLE platform_app LOGIN PASSWORD 'appdev'; END IF; END $$;
GRANT CONNECT ON DATABASE eventplat TO platform_app; GRANT USAGE ON SCHEMA public TO platform_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO platform_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO platform_app;`);
// The policy file drops and recreates its own policies, so it is safe to re-run.
psql(null, readFileSync(join(api, 'prisma', 'policies', 'tenant-rls.sql')));

const envFile = join(api, '.env');
if (existsSync(envFile)) {
  console.log('→ apps/api/.env already exists, left untouched');
} else {
  console.log('→ writing apps/api/.env');
  writeFileSync(
    envFile,
    [
      'NODE_ENV=development',
      'PORT=4000',
      'CORS_ORIGINS=http://localhost:5173',
      'WEB_APP_URL=http://localhost:5173',
      `DATABASE_URL=${APP_URL}`,
      `JWT_ACCESS_SECRET=${randomBytes(48).toString('base64')}`,
      'REDIS_URL=redis://localhost:63799',
      'STORAGE_PROVIDER=local',
      'STORAGE_LOCAL_DIR=./storage',
      'EMAIL_PROVIDER=console',
      'RATE_LIMIT_ENABLED=true',
      '',
    ].join('\n'),
  );
}

console.log(`
Ready. Start the apps with:   npm run dev
  API  http://localhost:4000/api/v1   (Swagger: /api/docs)
  Web  http://localhost:5173
E-mails are printed in the API log (EMAIL_PROVIDER=console): copy the verification link from there.
To create a first platform administrator:  SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='…' npm run db:seed`);
