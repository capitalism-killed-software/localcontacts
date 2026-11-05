import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Tests that write a database and its backups take seconds on CI's Windows
    // runners (one took 9 s); 5 s, the default, failed there. Speed is checked
    // where it matters, by the tests themselves (duplicates on 7,000 cards).
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
