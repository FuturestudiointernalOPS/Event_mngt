import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Isolation suite (WP-02).
 *
 * Deliberately separate from `vitest.config.ts`: it needs a real database, the runtime
 * role, and a running server, so it must not run in the normal `npm test` loop.
 *
 *   npm run test:isolation
 *
 * Skips itself when DATABASE_URL or APP_DATABASE_URL is absent.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@event-platform/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['test/isolation/**/*.isolation.ts'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
