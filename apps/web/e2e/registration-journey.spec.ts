import { expect, test } from '@playwright/test';
import { PASSWORD, seedEvent } from './support';

test('a visitor registers, staff approve, and a badge is issued', async ({ page, request }) => {
  const seeded = await seedEvent(request);

  // 1. Public registration with the organiser's dynamic form and consent.
  await page.goto(`/e/${seeded.eventSlug}/register`);
  await page.getByLabel('Category').selectOption('visitor');
  await page.getByLabel('First name').fill('Ines');
  await page.getByLabel('Last name').fill('Playwright');
  await page.getByLabel('Email address').fill(`ines.${Date.now()}@example.test`);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByText(/waiting for review/i)).toBeVisible();

  // 2. Staff sign in and confirm the pending registration.
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email address').fill(seeded.email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait for the sign-in to finish: navigating away mid-request would drop the session.
  await page.waitForURL(/\/workspace\//);
  await page.goto(`/workspace/${seeded.slug}/events/${seeded.eventId}/registrations`);
  await expect(page.getByText('Ines Playwright')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  // The status pill of the row (not the hidden option of the status filter).
  const row = page.locator('li', { hasText: 'Ines Playwright' });
  await expect(row.getByText('Approved')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);

  // 3. Approval issues a badge; the staff can see its state and reissue it.
  await row.getByText('Ines Playwright').click();
  await expect(row.getByText('Issued')).toBeVisible();
  await expect(row.getByRole('button', { name: 'Reissue badge' })).toBeVisible();
});

test('the public form refuses a missing consent and names the problem', async ({ page, request }) => {
  const seeded = await seedEvent(request);
  await page.goto(`/e/${seeded.eventSlug}/register`);
  await page.getByLabel('Category').selectOption('visitor');
  await page.getByLabel('First name').fill('No');
  await page.getByLabel('Last name').fill('Consent');
  await page.getByLabel('Email address').fill(`no.${Date.now()}@example.test`);
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByRole('alert')).toContainText(/consent/i);
});

test('an unknown event shows a not-found state instead of a blank page', async ({ page }) => {
  await page.goto('/e/this-event-does-not-exist');
  await expect(page.getByText('Page not found')).toBeVisible();
});
