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

test('clean-up: a possible duplicate can be kept apart, undone, then merged', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('More').selectOption({ label: 'Clean up…' });
  await expect(page).toHaveURL(/sheet=tidy/);
  const sheet = page.locator('.tidy-panel');
  const pair = sheet.locator('.dupe-pair');
  await expect(pair).toHaveCount(1);
  await expect(pair).toContainText('Same name');
  await expect(pair.locator('.dupe-side-name')).toHaveText(['Sam Rivera', 'Sam Rivera']);

  await pair.getByLabel('Not the same person').check();
  await sheet.getByRole('button', { name: /^Apply/ }).click();
  await expect(sheet.locator('.tidy-message')).toContainText('Kept 1 pair apart');
  await expect(pair).toHaveCount(0);
  await expect(sheet).toContainText('No possible duplicates');

  await sheet.getByRole('button', { name: 'Undo' }).click();
  await expect(sheet.locator('.tidy-message')).toContainText('Undone');
  await expect(pair).toHaveCount(1);

  await pair.getByLabel('Keep left').check();
  await sheet.getByRole('button', { name: /^Apply/ }).click();
  await expect(sheet.locator('.tidy-message')).toContainText('Merged 1 pair');
  await expect(count(page)).toHaveText(/^16 cards/);
});

test('clean-up: names and industries are previewed, then applied for the ones left ticked', async ({ page }) => {
  await page.goto('/?sheet=tidy&tab=names');
  const sheet = page.locator('.tidy-panel');
  const fix = sheet.locator('.tidy-row', { hasText: 'jo.baker@example.com' });
  await expect(fix).toContainText('Jo Baker');
  await expect(fix.getByRole('checkbox')).toBeChecked();
  await sheet.getByRole('button', { name: /^Apply/ }).click();
  await expect(sheet.locator('.tidy-message')).toContainText('Tidied 1 name');
  await expect(sheet).toContainText('No names to tidy');

  await sheet.getByRole('link', { name: /^Industries/ }).click();
  const rows = sheet.locator('.tidy-row');
  await expect(rows.first()).toBeVisible();
  const total = await rows.count();
  const dental = rows.filter({ hasText: 'Riverside Dental Clinic' });
  await expect(dental).toContainText('Healthcare / Biotech');
  await dental.getByRole('checkbox').uncheck();
  await sheet.getByRole('button', { name: /^Apply/ }).click();
  await expect(sheet.locator('.tidy-message')).toContainText(`Filled in ${total - 1} industr`);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Riverside Dental Clinic');
});

test('the guided import: pick your services, follow the steps, and each one ticks itself when its file is in', async ({ page }) => {
  await page.goto('/?sheet=guide');
  const sheet = page.locator('.guide-panel');
  // Apple's cards are already in the book (imported above), so it is chosen and ticked.
  await expect(sheet.getByRole('checkbox', { name: /Apple/ })).toBeChecked();
  await expect(sheet.locator('.guide-slot[data-service=apple]')).toHaveClass(/is-done/);

  await sheet.getByRole('checkbox', { name: 'Google Contacts' }).check();
  await sheet.getByRole('checkbox', { name: 'LinkedIn' }).check();
  const google = sheet.locator('.guide-slot[data-service=google]');
  const linkedin = sheet.locator('.guide-slot[data-service=linkedin]');
  await expect(linkedin).not.toHaveClass(/is-done/);
  await expect(linkedin.getByRole('link', { name: /Open LinkedIn/ })).toHaveAttribute('href', 'https://www.linkedin.com/help/linkedin/answer/a566336');
  await expect(linkedin.locator('details')).toContainText('Download your data');

  // A LinkedIn file dropped in the Google slot: a warning, not a refusal.
  await google.locator('input[type=file]').setInputFiles([fixture('linkedin-Connections.csv')]);
  await expect(google.locator('.guide-warning')).toContainText('LinkedIn');
  await expect(google.getByRole('button', { name: /^Import/ })).toBeVisible();
  await google.getByRole('button', { name: /^Remove/ }).click();
  await expect(google.locator('.guide-warning')).toHaveCount(0);

  // In its own slot it imports, in the LinkedIn group, and the slot ticks itself.
  await linkedin.locator('input[type=file]').setInputFiles([fixture('linkedin-Connections.csv')]);
  await linkedin.getByRole('button', { name: /^Import/ }).click();
  await expect(linkedin).toHaveClass(/is-done/);
  await expect(page.locator('.groups-pane')).toContainText('LinkedIn');

  // The choices are remembered on this computer.
  await page.reload();
  await expect(sheet.getByRole('checkbox', { name: 'Google Contacts' })).toBeChecked();
  await expect(sheet.locator('.guide-slot[data-service=linkedin]')).toHaveClass(/is-done/);
  await expect(sheet.getByRole('link', { name: /Look for duplicates/ })).toBeVisible();
});
