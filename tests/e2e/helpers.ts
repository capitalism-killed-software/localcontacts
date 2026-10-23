import { expect, type Page } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Same folder as playwright.config.ts gives the server.
export const E2E_DIR = process.env.E2E_DIR ?? join(tmpdir(), 'localcontacts-e2e');

export const FIXTURES = join(process.cwd(), 'tests', 'fixtures');
export const fixture = (n: string) => join(FIXTURES, n);

// Open the book and wait for the names list to load.
export async function openBook(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.locator('.names-count')).toContainText('card');
}

export const selectedName = (page: Page) => page.locator('.name-row.is-selected');

// Search, wait for the narrowed list, and open the first match.
export async function openFirstMatch(page: Page, query: string) {
  await page.locator('.search input').fill(query);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(query)}`));
  await expect(page.locator('.names-list')).not.toHaveAttribute('aria-busy', 'true');
  await page.locator('.names-canvas .name-row').first().click();
  await expect(page).toHaveURL(/id=\d+/);
}

export const currentId = (page: Page) => Number(new URL(page.url()).searchParams.get('id'));
