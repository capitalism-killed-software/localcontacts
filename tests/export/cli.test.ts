import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Round trip through the real scripts: import every fixture, export, import
// the export into an empty database, and compare.

const ROOT = process.cwd();
const TSX_CLI = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const FIX = (n: string) => join(ROOT, 'tests', 'fixtures', n);
const FIXTURES = [
  'google-contacts.vcf', 'apple-contacts.vcf', 'proton-contacts.vcf', 'android-v21.vcf',
  'google-contacts.csv', 'outlook-contacts.csv', 'linkedin-Connections.csv', 'telegram-result.json',
  'generic-crm.csv', 'export-edge.vcf',
].map(FIX);

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'localcontacts-export-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function run(script: string, db: string, args: string[]): { status: number; out: string; err: string } {
  const r = spawnSync(process.execPath, [TSX_CLI, script, ...args], {
    cwd: ROOT,
    env: { ...process.env, CONTACTS_DB_PATH: db },
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: r.status ?? 1, out: r.stdout, err: r.stderr };
}

type Row = Record<string, string | null>;
function rows(db: string): Map<string, Row> {
  const d = new DatabaseSync(db);
  try {
    const all = d
      .prepare('SELECT full_name, email, alt_emails, phone, alt_phones, urls, notes, company, title, connected_on, hex(photo) AS photo FROM contacts')
      .all() as Row[];
    return new Map(all.map((r) => [r.full_name as string, r]));
  } finally {
    d.close();
  }
}

const COMPARE = ['email', 'alt_emails', 'phone', 'alt_phones', 'urls', 'notes', 'company', 'title'];

// Each test spawns the real scripts through tsx, which is slow on some CI runners.
describe('export CLI', { timeout: 60_000 }, () => {
  it('round-trips every fixture through vCard and through CSV', () => {
    const db1 = join(dir, 'one.db');
    expect(run('scripts/import.ts', db1, ['--apply', ...FIXTURES]).status).toBe(0);
    const original = rows(db1);
    expect(original.size).toBeGreaterThan(8);
    expect([...original.values()].filter((r) => r.photo).length).toBeGreaterThan(0);

    for (const format of ['vcard', 'csv'] as const) {
      const file = join(dir, format === 'vcard' ? 'all.vcf' : 'all.csv');
      const exp = run('scripts/export.ts', db1, [`--format=${format}`, `--out=${file}`]);
      expect(exp.status).toBe(0);
      expect(exp.err).toMatch(/Exported \d+ cards/);

      const db2 = join(dir, `${format}.db`);
      expect(run('scripts/import.ts', db2, ['--apply', file]).status).toBe(0);
      const back = rows(db2);
      for (const [name, a] of original) {
        // A nameless card comes back named after its email or company.
        const b = back.get(name) ?? [...back.values()].find((r) => r.email && r.email === a.email);
        expect(b, `${format}: ${name}`).toBeDefined();
        for (const k of COMPARE) expect(b![k], `${format}: ${name} ${k}`).toBe(a[k]);
        if (format === 'csv') expect(b!.connected_on, `${name} connected_on`).toBe(a.connected_on);
        if (format === 'vcard') expect(b!.photo, `${name} photo`).toBe(a.photo);
      }
      expect(back.size).toBe(original.size);
    }
  });

  it('writes to stdout, applies filters, and guards files', () => {
    const db = join(dir, 'f.db');
    run('scripts/import.ts', db, ['--apply', FIX('linkedin-Connections.csv'), FIX('telegram-result.json')]);
    const all = run('scripts/export.ts', db, ['--format=vcard']);
    // Ada and Mary appear in both files and merge by name.
    expect(all.out.match(/BEGIN:VCARD/g)).toHaveLength(2);
    const tg = run('scripts/export.ts', db, ['--format=csv', '--source=telegram']);
    expect(tg.out.trim().split('\r\n')).toHaveLength(3);
    expect(tg.out).toMatch(/,\+1 202 555 01\d\d,/);
    const excel = run('scripts/export.ts', db, ['--format=csv', '--source=telegram', '--excel']);
    expect(excel.out).toMatch(/,'\+1 202 555 01\d\d,/);
    const q = run('scripts/export.ts', db, ['--format=csv', '--q=shelley']);
    expect(q.out).toContain('Mary Shelley');
    expect(q.out).not.toContain('Ada Lovelace');

    const file = join(dir, 'x.vcf');
    writeFileSync(file, 'keep me');
    const refused = run('scripts/export.ts', db, ['--format=vcard', `--out=${file}`]);
    expect(refused.status).toBe(1);
    expect(readFileSync(file, 'utf-8')).toBe('keep me');
    expect(run('scripts/export.ts', db, ['--format=vcard', `--out=${file}`, '--force']).status).toBe(0);
    expect(readFileSync(file, 'utf-8')).toContain('BEGIN:VCARD');

    expect(run('scripts/export.ts', db, ['--format=pdf']).status).toBe(1);
    expect(run('scripts/export.ts', db, []).status).toBe(1);
    expect(run('scripts/export.ts', db, ['--format=csv', '--filter=bogus']).status).toBe(1);
    expect(existsSync(join(dir, 'nothing.csv'))).toBe(false);
  });

  it('restores groups, industry and dates, and re-importing into the same book changes nothing', () => {
    const db1 = join(dir, 'one.db');
    const crlf = join(dir, 'outlook-notes.csv');
    writeFileSync(crlf, 'Name,Email,Notes\r\nNora Notes,nora@example.com,"Line one\r\nLine two"\r\n');
    expect(run('scripts/import.ts', db1, ['--apply', ...FIXTURES, '--source=work_friends', crlf]).status).toBe(0);
    const d = new DatabaseSync(db1);
    d.exec("UPDATE contacts SET industry = 'Legal', last_contacted = '2026-01-02' WHERE full_name = 'Nora Notes'");
    d.close();
    const snapshot = (db: string) => {
      const x = new DatabaseSync(db);
      try {
        return x.prepare('SELECT full_name, email, alt_emails, phone, alt_phones, urls, notes, company, title, connected_on, last_contacted, industry, sources, hex(photo) AS photo FROM contacts ORDER BY full_name, email').all();
      } finally {
        x.close();
      }
    };
    const before = snapshot(db1);
    expect(before.find((r) => r.full_name === 'Nora Notes')).toMatchObject({ notes: 'Line one\nLine two', sources: 'work_friends' });

    for (const format of ['vcard', 'csv'] as const) {
      const file = join(dir, `book.${format === 'vcard' ? 'vcf' : 'csv'}`);
      expect(run('scripts/export.ts', db1, [`--format=${format}`, `--out=${file}`, '--force']).status).toBe(0);
      // Into the same book: nothing new, nothing changed (no doubled notes, no "vcard" group).
      const again = run('scripts/import.ts', db1, ['--apply', file]);
      expect(again.status, again.err).toBe(0);
      expect(snapshot(db1), format).toEqual(before);
      // Into an empty book: the same cards, groups, industry and dates (CSV carries no photos).
      const db2 = join(dir, `restore-${format}.db`);
      expect(run('scripts/import.ts', db2, ['--apply', file]).status).toBe(0);
      const strip = (rows: Record<string, unknown>[]) => rows.map((r) => (format === 'csv' ? { ...r, photo: null } : r));
      expect(strip(snapshot(db2)), format).toEqual(strip(before));
    }
  });

  it('says so when --out names a folder that does not exist', () => {
    const db = join(dir, 'one.db');
    expect(run('scripts/import.ts', db, ['--apply', FIXTURES[0]]).status).toBe(0);
    const r = run('scripts/export.ts', db, ['--format=vcard', `--out=${join(dir, 'missing', 'x.vcf')}`]);
    expect(r.status).toBe(1);
    expect(r.err).toMatch(/its folder does not exist/);
    expect(r.err).not.toMatch(/\n\s+at /);
  });

  it('keeps an untagged card untagged, and an email field that holds no address, through a round trip', () => {
    const db1 = join(dir, 'one.db');
    expect(run('scripts/import.ts', db1, ['--apply', FIXTURES[0]]).status).toBe(0);
    const d = new DatabaseSync(db1);
    d.prepare("INSERT INTO contacts (full_name, email, sources) VALUES ('Odd Email', '(555)5550199', NULL)").run();
    d.close();
    for (const format of ['vcard', 'csv'] as const) {
      const file = join(dir, `odd.${format}`);
      expect(run('scripts/export.ts', db1, [`--format=${format}`, `--out=${file}`]).status).toBe(0);
      const db2 = join(dir, `odd-${format}.db`);
      expect(run('scripts/import.ts', db2, ['--apply', file]).status).toBe(0);
      const x = new DatabaseSync(db2);
      const back = x.prepare("SELECT email, sources FROM contacts WHERE full_name = 'Odd Email'").get();
      x.close();
      expect(back, format).toEqual({ email: '(555)5550199', sources: null });
    }
  });
});
