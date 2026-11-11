import { defineConfig, devices } from '@playwright/test';

/**
 * Browser end-to-end tests. They drive a RUNNING stack, so start it first:
 *   npm run local:setup && npm run dev          (API :4000, web :5173)
 * and use an API with RATE_LIMIT_ENABLED=false and the console e-mail adapter.
 *
 *   E2E_WEB_URL   default http://localhost:5173
 *   E2E_API_URL   default http://localhost:4000
 *   E2E_DATABASE_URL  owner connection, used only to mark test accounts verified
 *
 * First run: npx playwright install chromium
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive|accessibility/ },
  ],
});
