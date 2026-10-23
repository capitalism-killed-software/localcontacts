import { expect, test } from '@playwright/test';
import { openBook } from './helpers';

// Screenshot baselines of the main views, to catch accidental changes to the
// Address Book look. They depend on the fonts installed, so CI skips them
// (--grep-invert @visual); refresh them on your machine after an intended
// change with: npx playwright test --grep @visual --update-snapshots
//
// The file name starts with 0 so these run first, on the freshly seeded
// database, before other tests add cards and change the group counts.

test.describe('@visual', () => {
  test('list', async ({ page }) => {
    await openBook(page, '/?q=e');
    await page.locator('.search input').blur();
    await expect(page).toHaveScreenshot('list.png');
  });

  test('card', async ({ page }) => {
    await openBook(page, '/?q=lovelace');
    await page.locator('.names-canvas .name-row').first().click();
    await page.locator('.search input').blur();
    await expect(page.locator('.card-name')).toBeVisible();
    await expect(page).toHaveScreenshot('card.png');
  });

  test('edit', async ({ page }) => {
    await openBook(page, '/?q=lovelace');
    await page.locator('.names-canvas .name-row').first().click();
    await page.getByText('Edit', { exact: true }).click();
    await page.locator('input[name="full_name"]').blur();
    await expect(page).toHaveScreenshot('edit.png');
  });

  test('phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openBook(page, '/?q=lovelace');
    await expect(page).toHaveScreenshot('phone.png');
  });
});
