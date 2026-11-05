import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Browser tests against the production build, on two servers with their own
// databases in the temp folder:
// - "chromium": seeded with every fixture and 7,000 generated contacts
//   (tests/e2e/seed.ts);
// - "fresh": an empty book, for the first-run tests (fresh-*.spec.ts).
// Tests share their server's database, so they run one at a time.
// Run with: npm run test:e2e
const PORT = Number(process.env.E2E_PORT ?? 3210);
const FRESH_PORT = PORT + 1;
export const E2E_DIR = join(tmpdir(), 'localcontacts-e2e');
const DB = join(E2E_DIR, 'contacts.db');
const FRESH_DIR = join(tmpdir(), 'localcontacts-e2e-fresh');
const next = (port: number) => `node node_modules/next/dist/bin/next start -p ${port}`;
const tsx = (file: string) => `node node_modules/tsx/dist/cli.mjs ${file}`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { toHaveScreenshot: { maxDiffPixels: 100 } },
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /fresh-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'fresh',
      testMatch: /fresh-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, baseURL: `http://localhost:${FRESH_PORT}` },
    },
  ],
  webServer: [
    {
      command: `${tsx('tests/e2e/seed.ts')} && ${next(PORT)}`,
      url: `http://localhost:${PORT}/`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { CONTACTS_DB_PATH: DB, E2E_DIR, NEXT_TELEMETRY_DISABLED: '1' },
    },
    {
      command: `${tsx('tests/e2e/fresh.ts')} && ${next(FRESH_PORT)}`,
      url: `http://localhost:${FRESH_PORT}/`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { CONTACTS_DB_PATH: join(FRESH_DIR, 'contacts.db'), E2E_DIR: FRESH_DIR, NEXT_TELEMETRY_DISABLED: '1' },
    },
  ],
});
