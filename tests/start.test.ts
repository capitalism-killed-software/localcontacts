import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_LISTEN, staleBuildWarning, startArgs } from '../scripts/start.mjs';

describe('npm start', () => {
  it('listens on this machine only by default', () => {
    expect(DEFAULT_LISTEN).toBe('127.0.0.1');
    expect(startArgs([], {})).toEqual(['start', '-H', '127.0.0.1']);
    // HOSTNAME is often set by shells and containers; it must not open the app to the network.
    expect(startArgs([], { HOSTNAME: 'my-laptop' })).toEqual(['start', '-H', '127.0.0.1']);
  });

  it('listens where CONTACTS_LISTEN says', () => {
    expect(startArgs([], { CONTACTS_LISTEN: '100.64.1.2' })).toEqual(['start', '-H', '100.64.1.2']);
    expect(startArgs([], { CONTACTS_LISTEN: '  ' })).toEqual(['start', '-H', '127.0.0.1']);
  });

  it('keeps the caller’s arguments and an explicit address', () => {
    expect(startArgs(['-p', '3176'], {})).toEqual(['start', '-p', '3176', '-H', '127.0.0.1']);
    expect(startArgs(['-H', '::1'], { CONTACTS_LISTEN: '0.0.0.0' })).toEqual(['start', '-H', '::1']);
    expect(startArgs(['--hostname=::1'], {})).toEqual(['start', '--hostname=::1']);
  });

  it('is what npm start, the launchers and the Docker image use', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts.start).toBe('node scripts/start.mjs');
    expect(readFileSync('scripts/app/launch.sh', 'utf8')).toMatch(/next start -H 127\.0\.0\.1 -p/);
    expect(readFileSync('scripts/app/launch.cmd', 'utf8')).toMatch(/next start -H 127\.0\.0\.1 -p/);
    // Both launchers install and build again after an update, not only the first time.
    for (const f of ['scripts/app/launch.sh', 'scripts/app/launch.cmd']) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).toMatch(/node scripts[\\/]app[\\/]prepare\.mjs/);
      expect(text, f).not.toMatch(/BUILD_ID/);
    }
    const docker = readFileSync('Dockerfile', 'utf8');
    expect(docker).toMatch(/CONTACTS_LISTEN=0\.0\.0\.0/);
    expect(readFileSync('docker-compose.yml', 'utf8')).toMatch(/"127\.0\.0\.1:3000:3000"/);
  });
});

describe('npm start after an update', () => {
  it('warns when the code is newer than the last build, and says what to run', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const root = mkdtempSync(join(tmpdir(), 'localcontacts-start-'));
    try {
      writeFileSync(join(root, 'package.json'), '{}');
      expect(staleBuildWarning(root)).toMatch(/npm run build/);
      mkdirSync(join(root, '.next'));
      writeFileSync(join(root, '.next', 'BUILD_ID'), 'x');
      const old = new Date(Date.now() - 60_000);
      utimesSync(join(root, 'package.json'), old, old);
      expect(staleBuildWarning(root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

