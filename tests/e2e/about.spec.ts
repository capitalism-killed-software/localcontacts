import { expect, test } from '@playwright/test';
import pkg from '../../package.json';
import { openBook } from './helpers';

const LATEST = 'https://api.github.com/repos/capitalism-killed-software/localcontacts/releases/latest';

test('nothing outside this computer is contacted while using the book and opening every sheet', async ({ page }) => {
  const outside: string[] = [];
  page.on('request', (r) => {
    const host = new URL(r.url()).hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') outside.push(r.url());
  });
  await openBook(page);
  await page.locator('.names-canvas .name-row').first().click();
  for (const sheet of ['import=1', 'sheet=guide', 'sheet=tidy', 'sheet=backups', 'sheet=export', 'sheet=about']) {
    await page.goto(`/?${sheet}`);
    await expect(page.locator('.card-pane .card')).toBeVisible();
  }
  await page.goto('/help/export');
  await page.waitForTimeout(300);
  expect(outside).toEqual([]);
});

test('Check for updates asks GitHub only when pressed, and says what it found', async ({ page }) => {
  const asked: string[] = [];
  let tag = 'v99.0.0';
  await page.route('https://api.github.com/**', (route) => {
    asked.push(route.request().url());
    return route.fulfill({ json: { tag_name: tag, html_url: 'https://github.com/capitalism-killed-software/localcontacts/releases/tag/v99.0.0' } });
  });
  await openBook(page, '/?sheet=about');
  const sheet = page.locator('.about-panel');
  await expect(sheet).toContainText(`localcontacts ${pkg.version}`);
  expect(asked).toEqual([]);

  await sheet.getByRole('button', { name: 'Check for updates' }).click();
  await expect(sheet.locator('.update-result')).toContainText('99.0.0 is out');
  await expect(sheet.locator('.update-result a')).toHaveAttribute('href', /releases\/tag\/v99\.0\.0$/);
  expect(asked).toEqual([LATEST]);

  tag = `v${pkg.version}`;
  await sheet.getByRole('button', { name: 'Check for updates' }).click();
  await expect(sheet.locator('.update-result')).toContainText('You have the latest version');

  // Anywhere else is refused by the browser itself.
  const blocked = await page.evaluate(() => fetch('https://example.com/').then(() => false, () => true));
  expect(blocked).toBe(true);
});
