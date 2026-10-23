import { expect, test } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { E2E_DIR, fixture, openBook } from './helpers';

test('import page: a bad file blocks, a dry run explains, Import writes and backs up', async ({ page }) => {
  await openBook(page);
  const before = await page.locator('.names-count').innerText();
  await page.locator('.groups-footer .btn').click();
  await expect(page).toHaveURL(/import=1/);

  const input = page.locator('.drop-zone input[type=file]');
  await input.setInputFiles([fixture('proton-contacts.vcf'), fixture('export-edge.vcf'), fixture('not-contacts.txt')]);
  const bad = page.locator('.import-files li.is-bad');
  await expect(bad).toContainText('not a contact export');
  await expect(page.locator('.import-actions .btn-done')).toHaveCount(0);

  await bad.locator('.photo-remove').click();
  await expect(page.locator('.import-summary')).toBeVisible();
  await expect(page.locator('.import-files')).toContainText('vCard, 4 contacts');
  const button = page.locator('.import-actions .btn-done');
  await expect(button).toContainText('Import');
  await button.click();
  await expect(page.locator('.import-done')).toContainText('Imported:');
  await expect(page.locator('.names-count')).not.toHaveText(before);

  const backups = join(E2E_DIR, 'backups');
  expect(existsSync(backups)).toBe(true);
  expect(readdirSync(backups).length).toBeGreaterThan(0);

  await page.locator('.import-done .btn', { hasText: 'Import more' }).click();
  await input.setInputFiles([fixture('export-edge.vcf')]);
  await expect(page.locator('.import-status').last()).toContainText('already here');
});

test('import page: choosing columns for a CSV it cannot read on its own', async ({ page }) => {
  await openBook(page, '/?import=1');
  await page.locator('.drop-zone input[type=file]').setInputFiles([fixture('unguessable.csv')]);
  const row = page.locator('.import-files > li').first();
  await expect(row).toHaveClass(/is-bad/);
  await expect(row.locator('.import-map')).toBeVisible();
  await row.locator('.import-map-row', { hasText: /^name/ }).locator('select').selectOption('Who');
  await expect(row).toHaveClass(/is-ok/);
  await expect(row).toContainText('2 contacts');
  await row.locator('.import-map-row', { hasText: /^email/ }).locator('select').selectOption('Mail');
  await expect(page.locator('.import-summary')).toBeVisible();
  await page.locator('.import-actions .btn-done').click();
  await expect(page.locator('.import-done')).toContainText('Imported: 2 new');
  await page.goto('/?q=unguessed');
  await page.locator('.names-canvas .name-row').first().click();
  await expect(page.locator('.card-fields')).toContainText('@example.com');
});

test('the import endpoint refuses other websites', async ({ request }) => {
  const res = await request.post('/api/import', {
    headers: { Origin: 'https://evil.example' },
    multipart: { file: { name: 'x.vcf', mimeType: 'text/vcard', buffer: Buffer.from('BEGIN:VCARD\nFN:X\nEND:VCARD\n') }, apply: '1' },
  });
  expect(res.status()).toBe(403);
});

test('the export guide is served by the app itself', async ({ page }) => {
  await page.goto('/?import=1');
  const [guide] = await Promise.all([page.waitForEvent('popup'), page.getByText('How to export them').click()]);
  await expect(guide).toHaveURL(/\/help\/export$/);
  await expect(guide.locator('h2#google-contacts')).toBeVisible();
  await expect(guide.locator('.help-body table').first()).toBeVisible();
});
