// An empty book for the first-run browser tests (the "fresh" project in
// playwright.config.ts): the folder is wiped so every run starts from nothing.
import { mkdirSync, rmSync } from 'node:fs';

const dir = process.env.E2E_DIR;
if (!dir || !process.env.CONTACTS_DB_PATH) throw new Error('E2E_DIR and CONTACTS_DB_PATH must be set (playwright.config.ts does this)');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
console.log(`empty book in ${dir}`);
