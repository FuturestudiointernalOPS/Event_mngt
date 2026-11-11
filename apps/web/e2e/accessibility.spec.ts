import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedEvent } from './support';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function violations(page: import('@playwright/test').Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return result.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}`);
}

test('public pages have no WCAG A/AA violations', async ({ page, request }) => {
  const seeded = await seedEvent(request);
  for (const path of ['/login', `/e/${seeded.eventSlug}`, `/e/${seeded.eventSlug}/register`]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await violations(page), path).toEqual([]);
  }
});
