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

test('the import endpoint refuses other websites', async ({ request }) => {
  const res = await request.post('/api/import', {
    headers: { Origin: 'https://evil.example' },
    multipart: { file: { name: 'x.vcf', mimeType: 'text/vcard', buffer: Buffer.from('BEGIN:VCARD\nFN:X\nEND:VCARD\n') }, apply: '1' },
  });
  expect(res.status()).toBe(403);
});
