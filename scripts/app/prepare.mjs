#!/usr/bin/env node
// Gets the app ready to start, for the launchers (npm run app, launch.cmd):
// installs the dependencies when package-lock.json is newer than the last
// install, and builds when anything the build reads is newer than the last
// build. After a `git pull` to a new version, both happen by themselves.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// What the production build is made from.
const BUILD_INPUTS = ['package.json', 'package-lock.json', 'next.config.mjs', 'tsconfig.json', 'src', 'public', 'seed', 'docs/exporting-your-contacts.md'];

const mtime = (path) => (existsSync(path) ? statSync(path).mtimeMs : 0);

/** The newest modification time of a file, or of any file under a folder (folders' own times
 *  change whenever something is created in them, so they don't count). */
function newest(path) {
  if (!existsSync(path)) return 0;
  const st = statSync(path);
  if (!st.isDirectory()) return st.mtimeMs;
  let t = 0;
  for (const entry of readdirSync(path)) t = Math.max(t, newest(join(path, entry)));
  return t;
}

export function needsBuild(root) {
  const built = mtime(join(root, '.next', 'BUILD_ID'));
  if (!built) return true;
  return BUILD_INPUTS.some((p) => newest(join(root, p)) > built);
}

export function needsInstall(root) {
  const installed = mtime(join(root, 'node_modules', '.package-lock.json'));
  return !installed || mtime(join(root, 'package-lock.json')) > installed;
}

function npm(args, root) {
  const r = spawnSync('npm', args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  if (needsInstall(root)) {
    console.log('Installing what localcontacts needs (first start or a new version)…');
    npm(['install', '--no-audit', '--no-fund'], root);
  }
  if (needsBuild(root)) {
    console.log('Building localcontacts (first start or a new version; about a minute)…');
    npm(['run', 'build'], root);
  }
}
