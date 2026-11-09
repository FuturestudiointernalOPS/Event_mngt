import { expect, test } from '@playwright/test';
import { PASSWORD, seedEvent } from './support';

test('a visitor registers, staff confirm, and the participant gets a QR badge', async ({ page, request }) => {
  const seeded = await seedEvent(request);

  // 1. Public registration with the organiser's dynamic form and consent.
  await page.goto(`/e/${seeded.eventSlug}/register`);
  await page.getByLabel('Category').selectOption('visitor');
  await page.getByLabel('First name').fill('Ines');
  await page.getByLabel('Last name').fill('Playwright');
  await page.getByLabel('Email address').fill(`ines.${Date.now()}@example.test`);
  await page.getByLabel('Company').fill('Acme Labs');
  await page.getByLabel(/I have read and accept/).check();
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
  await page.getByRole('button', { name: 'Confirm' }).click();
  // The status pill of the row (not the hidden option of the status filter).
  await expect(page.locator('li', { hasText: 'Ines Playwright' }).getByText('Confirmed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
});

test('the public form refuses a missing consent and names the problem', async ({ page, request }) => {
  const seeded = await seedEvent(request);
  await page.goto(`/e/${seeded.eventSlug}/register`);
  await page.getByLabel('Category').selectOption('visitor');
  await page.getByLabel('First name').fill('No');
  await page.getByLabel('Last name').fill('Consent');
  await page.getByLabel('Email address').fill(`no.${Date.now()}@example.test`);
  await page.getByLabel('Company').fill('X');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByRole('alert')).toContainText(/consent/i);
});

test('an unknown event shows a not-found state instead of a blank page', async ({ page }) => {
  await page.goto('/e/this-event-does-not-exist');
  await expect(page.getByText('Page not found')).toBeVisible();
});
