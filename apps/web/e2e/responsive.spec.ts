import { expect, test } from '@playwright/test';
import { seedEvent } from './support';

test('registration and login fit a phone screen without horizontal scrolling', async ({ page, request }) => {
  const seeded = await seedEvent(request);
  for (const path of ['/login', `/e/${seeded.eventSlug}/register`]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
