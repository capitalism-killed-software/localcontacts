// Vite (bundled with Vitest 2) predates Node 25's `node:sqlite` builtin and
// mangles the import. This shim loads the real builtin at runtime via
// createRequire, sidestepping Vite's static resolver. Aliased in vitest.config.ts.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sqlite = require('node:sqlite');

export const DatabaseSync = sqlite.DatabaseSync;
export default sqlite;
