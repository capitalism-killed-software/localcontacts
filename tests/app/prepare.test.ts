import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { needsBuild, needsInstall } from '../../scripts/app/prepare.mjs';

// The launchers (npm run app, launch.cmd) install and build only when needed:
// after a `git pull` the code is newer than the last build, so they build again.
let root: string;
const at = (rel: string, minutesAgo: number) => {
  const file = join(root, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, 'x');
  const t = new Date(Date.now() - minutesAgo * 60_000);
  utimesSync(file, t, t);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'localcontacts-prepare-'));
  at('package.json', 60);
  at('package-lock.json', 60);
  at('next.config.mjs', 60);
  at('src/app/page.tsx', 60);
  at('public/sw.js', 60);
  at('seed/sample-people.vcf', 60);
  at('docs/exporting-your-contacts.md', 60);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('needsBuild', () => {
  it('is true with no build, false after a build newer than the code', () => {
    expect(needsBuild(root)).toBe(true);
    at('.next/BUILD_ID', 10);
    expect(needsBuild(root)).toBe(false);
  });

  it('is true once anything the build reads is newer than it (a git pull)', () => {
    for (const changed of ['package.json', 'next.config.mjs', 'src/lib/deep/new-file.ts', 'public/sw.js', 'seed/sample-people.vcf', 'docs/exporting-your-contacts.md']) {
      at('.next/BUILD_ID', 10);
      at(changed, 1);
      expect(needsBuild(root), changed).toBe(true);
      at(changed, 60);
    }
  });

  it('ignores files the build does not read', () => {
    at('.next/BUILD_ID', 10);
    at('README.md', 1);
    at('data/contacts.db', 1);
    at('tests/x.test.ts', 1);
    expect(needsBuild(root)).toBe(false);
  });
});

describe('needsInstall', () => {
  it('is true with no node_modules, or when the lock file is newer than the last install', () => {
    expect(needsInstall(root)).toBe(true);
    at('node_modules/.package-lock.json', 10);
    expect(needsInstall(root)).toBe(false);
    at('package-lock.json', 1);
    expect(needsInstall(root)).toBe(true);
  });
});
