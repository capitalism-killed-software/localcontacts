import { expect, test } from '@playwright/test';
import { currentId, openBook, selectedName } from './helpers';

test('7,000 names: only the visible rows are drawn and the letter pins while scrolling', async ({ page }) => {
  await openBook(page);
  expect(await page.locator('.names-canvas .name-row').count()).toBeLessThan(100);
  await page.locator('.names-list').evaluate((el) => (el.scrollTop = 90000));
  await expect(page.locator('.names-pin .name-section')).toHaveText(/^[A-Z#]$/);
  expect(await page.locator('.names-canvas .name-row').count()).toBeLessThan(100);
});

test('a card click sends the card, not the list', async ({ page }) => {
  await openBook(page);
  await page.locator('.names-canvas .name-row').nth(4).click();
  await expect(page).toHaveURL(/id=\d+/);
  await page.locator('.names-canvas .name-row').nth(6).click();
  await page.waitForLoadState('networkidle');
  const sizes = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e) => e.name.includes('_rsc'))
      .map((e) => (e as PerformanceResourceTiming).decodedBodySize)
  );
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) expect(s).toBeLessThan(50_000);
  const listFetches = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/contacts')).length);
  expect(listFetches).toBe(1);
});

test('arrow keys, Home, End and page keys move between cards', async ({ page }) => {
  await openBook(page);
  const { rows } = await (await page.request.get('/api/contacts')).json();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ArrowDown');
  await expect(page).toHaveURL(new RegExp(`id=${rows[0][0]}$`));
  await page.keyboard.press('ArrowDown');
  await expect(page).toHaveURL(new RegExp(`id=${rows[1][0]}$`));
  await page.keyboard.press('ArrowUp');
  await expect(page).toHaveURL(new RegExp(`id=${rows[0][0]}$`));
  await page.keyboard.press('End');
  await expect(page).toHaveURL(new RegExp(`id=${rows[rows.length - 1][0]}$`));
  await expect(selectedName(page)).toBeInViewport();
  await page.keyboard.press('Home');
  await expect(page).toHaveURL(new RegExp(`id=${rows[0][0]}$`));

  const id = currentId(page);
  await page.locator('.search input').click();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  expect(currentId(page)).toBe(id);

  await page.goto(`/?id=${id}&edit=1`);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/edit=1/);
});

test('search narrows the list and the count', async ({ page }) => {
  await openBook(page);
  await page.locator('.search input').fill('lovelace');
  await expect(page.locator('.names-count')).toHaveText('1 card');
  await page.locator('.search input').fill('');
  await expect(page.locator('.names-count')).toContainText(/7,0\d\d cards/);
});

test('typing a name with the list focused jumps to it', async ({ page }) => {
  await openBook(page);
  await page.locator('.names-list').focus();
  await page.keyboard.type('lovel');
  await expect(selectedName(page)).toContainText('Lovel');
  await expect(selectedName(page)).toBeInViewport();
  await page.waitForTimeout(900);
  await page.keyboard.type('turn');
  await expect(selectedName(page)).toContainText('Turn');
});
