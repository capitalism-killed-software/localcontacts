import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// node:sqlite is newer than the Vite version bundled with Vitest 2, which strips
// the `node:` prefix and then fails to load a bare "sqlite" module. Alias it to
// a shim that pulls the real builtin in via createRequire at runtime.
const sqliteShim = fileURLToPath(new URL('./tests/node-sqlite-shim.mjs', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^node:sqlite$/, replacement: sqliteShim },
      { find: /^sqlite$/, replacement: sqliteShim },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
