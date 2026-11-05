import { expect, test } from '@playwright/test';
import { fixture } from './helpers';

// A first run, in order, on a book that starts empty (the "fresh" project's
// own server and database). Each step builds on the one before.
test.describe.configure({ mode: 'serial' });

const count = (page: import('@playwright/test').Page) => page.locator('.names-count');

test('an empty book greets you with ways to start', async ({ page }) => {
  await page.goto('/');
  await expect(count(page)).toHaveText(/^0 cards/);
  const welcome = page.locator('.welcome');
  await expect(welcome).toContainText('Your address book is empty');
  await expect(welcome.getByRole('link', { name: /Where do I get my contacts/ })).toHaveAttribute('href', '/help/export');
  await expect(welcome.getByRole('button', { name: /Look around with sample people/ })).toBeVisible();
});

test('sample people can be loaded, are marked as made up, and the banner says so', async ({ page }) => {
  await page.goto('/');
  await page.locator('.welcome').getByRole('button', { name: /Look around with sample people/ }).click();
  await expect(count(page)).toHaveText(/^15 cards/);
  const banner = page.locator('.sample-banner');
  await expect(banner).toContainText('15 people here are made up');
  await expect(banner.getByRole('button', { name: 'Remove them' })).toBeVisible();
  await expect(page.locator('.welcome')).toHaveCount(0);
});

test('importing your own file offers to clear the sample people out first', async ({ page }) => {
  await page.goto('/?import=1');
  const clear = page.getByLabel(/Remove the 15 sample people first/);
  await expect(clear).toBeChecked();
  await page.locator('.drop-zone input[type=file]').setInputFiles([fixture('apple-contacts.vcf')]);
  await expect(page.locator('.import-summary')).toContainText('15 → 2');
  // Keep them this time, so the next test can remove them from the banner.
  await clear.uncheck();
  await expect(page.locator('.import-summary')).toContainText('15 → 17');
  await page.locator('.import-actions .btn-done').click();
  await expect(page.locator('.import-done')).toContainText('Imported: 2 new');
  await expect(count(page)).toHaveText(/^17 cards/);
});

test('the banner removes the sample people in one click and keeps your own cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.sample-banner')).toContainText('15 people here are made up');
  await page.locator('.sample-banner').getByRole('button', { name: 'Remove them' }).click();
  await expect(count(page)).toHaveText(/^2 cards/);
  await expect(page.locator('.sample-banner')).toHaveCount(0);
  await page.goto('/?import=1');
  await expect(page.getByLabel(/sample people first/)).toHaveCount(0);
});

test('an import can be undone straight away', async ({ page }) => {
  await page.goto('/?import=1');
  await page.locator('.drop-zone input[type=file]').setInputFiles([fixture('linkedin-Connections.csv')]);
  await page.locator('.import-actions .btn-done').click();
  await expect(page.locator('.import-done')).toContainText('Imported:');
  await expect(count(page)).not.toHaveText(/^2 cards/);
  await page.getByRole('button', { name: 'Undo this import' }).click();
  await expect(page.locator('.import-done')).toContainText('Undone');
  await expect(count(page)).toHaveText(/^2 cards/);
  await expect(page.getByRole('button', { name: 'Undo this import' })).toHaveCount(0);
});

test('the backups sheet says why each backup was taken, and restores one after saving the book', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('More').selectOption({ label: 'Backups…' });
  await expect(page).toHaveURL(/sheet=backups/);
  const rows = page.locator('.backup-row');
  await expect(rows.locator('.backup-label')).toHaveText([
    /^Before restoring the backup from /,
    'Before importing linkedin-Connections.csv',
    'Before removing the sample people',
    'Before importing apple-contacts.vcf',
  ]);
  // Undo was just used, so there is no import left to undo.
  await expect(page.locator('.backup-undo')).toHaveCount(0);
  page.once('dialog', (d) => d.accept());
  await rows.filter({ hasText: 'Before removing the sample people' }).getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('.backup-message')).toContainText('Restored');
  await expect(count(page)).toHaveText(/^17 cards/);
  await expect(page.locator('.sample-banner')).toBeVisible();
  await expect(rows).toHaveCount(5);
});

test('a backup can be deleted, after asking', async ({ page }) => {
  await page.goto('/?sheet=backups');
  const rows = page.locator('.backup-row');
  await expect(rows).toHaveCount(5);
  page.once('dialog', (d) => d.dismiss());
  await rows.last().getByRole('button', { name: 'Delete' }).click();
  await expect(rows).toHaveCount(5);
  page.once('dialog', (d) => d.accept());
  await rows.last().getByRole('button', { name: 'Delete' }).click();
  await expect(rows).toHaveCount(4);
  await expect(page.locator('.backup-message')).toContainText('Deleted');
});
