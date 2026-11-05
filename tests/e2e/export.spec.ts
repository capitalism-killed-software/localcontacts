import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openBook } from './helpers';

test('the export sheet downloads what the book shows, as CSV or vCard', async ({ page }) => {
  await openBook(page, '/?source=linkedin');
  await page.getByLabel('More').selectOption({ label: 'Export…' });
  await expect(page).toHaveURL(/source=linkedin.*sheet=export|sheet=export.*source=linkedin/);
  const sheet = page.locator('.export-panel');
  await expect(sheet).toContainText('LinkedIn');
  await expect(sheet).toContainText('2 cards');

  const [csv] = await Promise.all([page.waitForEvent('download'), sheet.getByRole('link', { name: /Spreadsheet/ }).click()]);
  expect(csv.suggestedFilename()).toMatch(/^contacts-linkedin-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = readFileSync(await csv.path(), 'utf-8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text.trim().split('\r\n')).toHaveLength(3);

  const [vcf] = await Promise.all([page.waitForEvent('download'), sheet.getByRole('link', { name: /vCard/ }).click()]);
  expect(vcf.suggestedFilename()).toMatch(/^contacts-linkedin-\d{4}-\d{2}-\d{2}\.vcf$/);
  expect(readFileSync(await vcf.path(), 'utf-8').match(/BEGIN:VCARD/g)).toHaveLength(2);

  // From a group, the whole book is one click away.
  await sheet.getByRole('link', { name: /Export all/ }).click();
  await expect(page).not.toHaveURL(/source=/);
  await expect(page.locator('.export-panel')).toContainText('All Contacts');
});

test('opening the export sheet does not start an export', async ({ page }) => {
  const exports: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/export')) exports.push(r.url());
  });
  await openBook(page, '/?sheet=export');
  await expect(page.locator('.export-panel')).toBeVisible();
  await page.waitForTimeout(500);
  expect(exports).toEqual([]);
});
