import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Browser tests against the production build. The server starts on its own
// database in the temp folder, seeded with every fixture and 7,000 generated
// contacts (tests/e2e/seed.ts). Tests share that database, so they run one
// at a time. Run with: npm run test:e2e
const PORT = Number(process.env.E2E_PORT ?? 3210);
export const E2E_DIR = join(tmpdir(), 'localcontacts-e2e');
const DB = join(E2E_DIR, 'contacts.db');

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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: `node node_modules/tsx/dist/cli.mjs tests/e2e/seed.ts && node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}/`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: { CONTACTS_DB_PATH: DB, E2E_DIR, NEXT_TELEMETRY_DISABLED: '1' },
  },
});
