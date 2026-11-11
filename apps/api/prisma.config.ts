import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration.
 *
 * Since Prisma 7 this file is the only place the CLI reads the database URL from:
 * `url` in the schema's datasource block is no longer accepted.
 *
 * The `dotenv/config` import restores `.env` loading, which the CLI no longer does
 * on its own. This file affects the CLI only — the running API still reads its
 * configuration through src/config/env.validation.ts.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    // Read process.env directly instead of the env() helper: env() throws when the
    // variable is missing, which would break `prisma generate` (run by postinstall) on
    // a fresh clone or in CI. Commands that actually connect still fail clearly when the
    // URL is empty.
    url: process.env.DATABASE_URL ?? '',
  },
});
