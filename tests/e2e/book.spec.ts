import { expect, test } from '@playwright/test';
import { currentId, openBook, openFirstMatch, selectedName } from './helpers';

test('the book opens with groups, a sectioned names list and an empty card', async ({ page }) => {
  await openBook(page);
  await expect(page.locator('.group.is-selected')).toContainText('All Contacts');
  await expect(page.locator('.groups-pane')).toContainText('Sources');
  await expect(page.locator('.names-count')).toContainText(/7,0\d\d cards/);
  await expect(page.locator('.names-canvas .name-section').first()).toBeVisible();
  await expect(page.locator('.card-blank')).toContainText('No Card Selected');
});

test('opening a card shows its fields and keeps the list where it was', async ({ page }) => {
  await openBook(page);
  await openFirstMatch(page, 'lovelace');
  await expect(page.locator('.card-name')).toContainText('Ada Lovelace');
  await expect(page.locator('.card-fields')).toContainText('ada@example.com');
  await expect(page.locator('.card-fields')).toContainText('other email');
  await expect(selectedName(page)).toContainText('Lovelace');
});

test('changing group or search keeps the open card', async ({ page }) => {
  await openBook(page);
  await openFirstMatch(page, 'lovelace');
  const id = currentId(page);
  await page.locator('.search input').fill('');
  await page.locator('.groups-pane .group', { hasText: 'Telegram' }).click();
  await expect(page).toHaveURL(new RegExp(`source=telegram.*id=${id}|id=${id}.*source=telegram`));
  await expect(page.locator('.card-name')).toContainText('Ada Lovelace');
  await expect(page.locator('.names-count')).toContainText('2 cards');
});

test('the ribbon hides and shows the groups and remembers it', async ({ page }) => {
  await openBook(page);
  const book = page.locator('.book');
  await expect(book).toHaveAttribute('data-groups', 'shown');
  await page.locator('.ribbon').click();
  await expect(book).toHaveAttribute('data-groups', 'hidden');
  await expect(page.locator('.groups-pane')).toBeHidden();
  await page.reload();
  await expect(book).toHaveAttribute('data-groups', 'hidden');
  await page.locator('.ribbon').click();
  await expect(book).toHaveAttribute('data-groups', 'shown');
});

test('a deep link scrolls its row into view; an unknown id says so', async ({ page }) => {
  const { rows } = await (await page.request.get('/api/contacts')).json();
  const farId = rows[rows.length - 20][0];
  await openBook(page, `/?id=${farId}`);
  await expect(selectedName(page)).toBeInViewport();
  await openBook(page, '/?id=99999999');
  await expect(page.locator('.card-blank')).toContainText('No card with that id');
});

test('old /contacts links redirect into the book', async ({ page }) => {
  await page.goto('/contacts/1?edit=1');
  await expect(page).toHaveURL(/\/\?id=1&edit=1$/);
  await page.goto('/contacts/new');
  await expect(page).toHaveURL(/\/\?new=1$/);
});

test('on a phone the book shows one page at a time', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBook(page);
  await expect(page.locator('.groups-select')).toBeVisible();
  await expect(page.locator('.page-right')).toBeHidden();
  await page.locator('.names-canvas .name-row').nth(3).click();
  await expect(page.locator('.page-left')).toBeHidden();
  await page.locator('.back-link').click();
  await expect(page.locator('.page-left')).toBeVisible();
});

test('an unknown page shows the book-style not-found sheet', async ({ page }) => {
  const res = await page.goto('/no/such/page');
  expect(res?.status()).toBe(404);
  await expect(page.locator('.error-sheet')).toContainText('Nothing here');
  await page.getByText('Back to Contacts').click();
  await expect(page.locator('.names-count')).toContainText('card');
});

test('the search box follows Back and Forward', async ({ page }) => {
  await openBook(page);
  await page.locator('.names-canvas .name-row').first().click();
  await openFirstMatch(page, 'lovelace');
  await page.locator('.search input').fill('hopper');
  await expect(page).toHaveURL(/q=hopper/);
  await page.goBack();
  await expect(page).toHaveURL(/q=lovelace/);
  await expect(page.locator('.search input')).toHaveValue('lovelace');
});

test('hidden groups stay hidden from the first paint', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('localcontacts.groups', 'hidden'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => document.documentElement.dataset.groups)).toBe('hidden');
  await expect(page.locator('.groups-pane')).toBeHidden();
});
