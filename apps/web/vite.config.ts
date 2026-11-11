import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The browser bundle consumes the contracts from source, so a missing or stale
      // packages/shared/dist can never break `dev`, `build` or `test` here. The API
      // still imports the compiled package.
      '@event-platform/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    // happy-dom replaces jsdom: it drops the deprecated whatwg-encoding tree and is
    // noticeably faster. Switch back to 'jsdom' only if a test needs fuller DOM
    // spec coverage.
    environment: 'happy-dom',
    globals: true,
    // Playwright specs run with `npm run e2e`, not under Vitest.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
