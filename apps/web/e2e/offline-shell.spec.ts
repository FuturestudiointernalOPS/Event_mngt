import { expect, test } from '@playwright/test';

/**
 * Needs the PRODUCTION build (the service worker only registers there):
 *   npm run build -w @event-platform/web && npx vite preview --port 4173
 *   E2E_WEB_URL=http://localhost:4173 npx playwright test offline-shell
 */
test.skip(!process.env.E2E_WEB_URL?.includes('4173'), 'run against the preview build');

test('after one visit the app shell loads with no connection', async ({ page, context }) => {
  await page.goto('/login');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
