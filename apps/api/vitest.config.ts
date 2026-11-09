import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * API tests run on Vitest, the same runner as the web app.
 *
 * Note: Vitest transpiles with esbuild, which does not emit decorator metadata. Pure
 * unit tests are unaffected; a test that instantiates a Nest provider through dependency
 * injection will need the SWC plugin added at that point.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Consume contracts from source so tests never depend on packages/shared/dist.
      '@event-platform/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
  },
});
