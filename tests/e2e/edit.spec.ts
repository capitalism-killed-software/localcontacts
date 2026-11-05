import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { currentId, openBook } from './helpers';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function newCard(page: import('@playwright/test').Page, name: string) {
  await openBook(page);
  await page.locator('.btn-plus').click();
  await expect(page).toHaveURL(/new=1/);
  await page.locator('input[name="full_name"]').fill(name);
  await page.locator('input[name="email"]').first().fill(`${name.toLowerCase().replace(/\W+/g, '.')}@example.com`);
  await page.locator('.btn-done').click();
  await expect(page).toHaveURL(/id=\d+$/);
  await expect(page.locator('.card-name')).toContainText(name);
  return currentId(page);
}

test('create, edit extra emails and phones, and delete a card', async ({ page }) => {
  const id = await newCard(page, 'Edith Example');
  await expect(page.locator('.name-row.is-selected')).toContainText('Example');

  await page.goto(`/?id=${id}&edit=1`);
  await page.getByRole('button', { name: 'Add email', exact: true }).click();
  await page.locator('input[name="email"]').nth(1).fill('edith.home@example.com');
  await page.getByRole('button', { name: 'Add phone', exact: true }).click();
  await page.locator('input[name="phone"]').last().fill('+1 202 555 0177');
  await page.locator('.btn-done').click();
  await expect(page.locator('.card-fields')).toContainText('edith.home@example.com');
  await expect(page.locator('.card-fields')).toContainText('+1 202 555 0177');

  await page.goto(`/?id=${id}&edit=1`);
  await page.locator('.edit-row:has(input[name="email"]) .round-btn.minus').last().click();
  await page.locator('.btn-done').click();
  await expect(page.locator('.card-fields')).not.toContainText('edith.home@example.com');

  await page.goto(`/?id=${id}&edit=1`);
  page.once('dialog', (d) => d.accept());
  await page.locator('.btn-delete').click();
  await expect(page).toHaveURL((u) => !u.search.includes('id='));
  await expect(page.locator('.names-list')).not.toContainText('Edith');
});

test('photos: a fake image is refused, a real one saved, then removed', async ({ page }, info) => {
  mkdirSync(info.outputDir, { recursive: true });
  const fake = join(info.outputDir, 'fake.png');
  const real = join(info.outputDir, 'real.png');
  writeFileSync(fake, '<html>not an image</html>');
  writeFileSync(real, PNG);
  const id = await newCard(page, 'Pat Photo');

  await page.goto(`/?id=${id}&edit=1`);
  await page.locator('input[name="photo"]').setInputFiles(fake);
  await expect(page.locator('.photo-error')).toContainText('JPEG, PNG, GIF or WebP');
  // A file cut off after the PNG header is refused too, not saved as a broken image.
  const cut = join(info.outputDir, 'cut.png');
  writeFileSync(cut, PNG.subarray(0, 40));
  await page.locator('input[name="photo"]').setInputFiles(cut);
  await expect(page.locator('.photo-error')).toContainText('damaged or cut off');
  await page.locator('input[name="photo"]').setInputFiles(real);
  await expect(page.locator('.photo-picker img')).toBeVisible();
  await page.locator('.btn-done').click();
  await expect(page.locator('.card .photo img')).toBeVisible();
  const res = await page.request.get(`/api/photo/${id}`);
  expect(res.headers()['content-type']).toBe('image/png');
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['content-security-policy']).toContain("default-src 'none'");

  await page.goto(`/?id=${id}&edit=1`);
  await page.locator('.photo-remove').click();
  await page.locator('.btn-done').click();
  await expect(page.locator('.card .photo img')).toHaveCount(0);
});

test('Export vCard downloads the card', async ({ page }) => {
  await openBook(page, '/?q=lovelace');
  await page.locator('.names-canvas .name-row').first().click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('Export vCard').click()]);
  expect(download.suggestedFilename()).toBe('Ada Lovelace.vcf');
  const text = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString());
  expect(text).toMatch(/^BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
  expect(text).toContain('EMAIL;TYPE=INTERNET;TYPE=PREF:ada@example.com');
});

test('Done works once: a double-click makes one card', async ({ page }) => {
  await openBook(page);
  await page.locator('.btn-plus').click();
  const name = `Dora Double ${Date.now()}`;
  await page.locator('input[name="full_name"]').fill(name);
  await page.locator('.btn-done').dblclick();
  await expect(page).toHaveURL(/id=\d+$/);
  const res = await page.request.get(`/api/contacts?q=${encodeURIComponent(name)}`);
  expect((await res.json()).count).toBe(1);
});

test('a name of only spaces is refused in the form, keeping what was typed', async ({ page }) => {
  await openBook(page);
  await page.locator('.btn-plus').click();
  await page.locator('input[name="full_name"]').fill('   ');
  await page.locator('input[name="company"]').fill('Spaces Inc');
  await page.locator('.btn-done').click();
  await expect(page).toHaveURL(/new=1/);
  expect(await page.locator('input[name="full_name"]').evaluate((el: HTMLInputElement) => el.validity.patternMismatch)).toBe(true);
  await expect(page.locator('input[name="company"]')).toHaveValue('Spaces Inc');
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
});

test('leaving a card with unsaved changes asks first; Cancel does not', async ({ page }) => {
  const id = await newCard(page, 'Una Unsaved');
  await page.goto(`/?id=${id}&edit=1`);
  await page.locator('input[name="company"]').fill('Changed Co');
  page.once('dialog', (d) => d.dismiss());
  await page.locator('.groups-pane a').first().click();
  await expect(page).toHaveURL(/edit=1/);
  await expect(page.locator('input[name="company"]')).toHaveValue('Changed Co');
  let asked = false;
  page.on('dialog', (d) => {
    asked = true;
    void d.accept();
  });
  await page.getByRole('link', { name: 'Cancel' }).click();
  await expect(page).not.toHaveURL(/edit=1/);
  expect(asked).toBe(false);
});

test('the edit form keeps one of each email and phone, and wants digits in a phone', async ({ page }) => {
  const id = await newCard(page, 'Dee Dupes');
  await page.goto(`/?id=${id}&edit=1`);
  await page.getByRole('button', { name: 'Add email' }).first().click();
  await page.locator('input[name="email"]').nth(1).fill('DEE.DUPES@example.com');
  await page.locator('input[name="phone"]').first().fill('call me maybe');
  await page.locator('.btn-done').click();
  expect(await page.locator('input[name="phone"]').first().evaluate((el: HTMLInputElement) => el.validity.patternMismatch)).toBe(true);
  await page.locator('input[name="phone"]').first().fill('+1 202 555 0130');
  await page.getByRole('button', { name: 'Add phone' }).first().click();
  await page.locator('input[name="phone"]').nth(1).fill('(202) 555-0130');
  await page.locator('.btn-done').click();
  await expect(page).toHaveURL(/id=\d+$/);
  const card = await (await page.request.get(`/api/vcard/${id}`)).text();
  expect(card.match(/^EMAIL/gm)).toHaveLength(1);
  expect(card.match(/^TEL/gm)).toHaveLength(1);
});
