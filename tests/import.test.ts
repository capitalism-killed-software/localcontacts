import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Integration test: runs the real import-csv.ts script (via tsx) against a
// temp CSV, writing to a temp SQLite file, then inspects that file directly.

const ROOT = process.cwd();
const TSX = join(ROOT, 'node_modules', '.bin', 'tsx');

let workdir: string;
let csvPath: string;
let dbPath: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'contacts-import-'));
  csvPath = join(workdir, 'sample.csv');
  dbPath = join(workdir, 'test.db');
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function runImport() {
  return execFileSync(TSX, ['scripts/import-csv.ts', csvPath], {
    cwd: ROOT,
    env: { ...process.env, CONTACTS_DB_PATH: dbPath },
    encoding: 'utf-8',
  });
}

describe('CSV importer', () => {
  it('imports valid rows, skips blank names, and maps icp_reason to notes', () => {
    writeFileSync(
      csvPath,
      [
        'id,full_name,title,company,email,phone,icp_reason,connected_on',
        '1,Ada Lovelace,Mathematician,Analytical Engine,ada@example.com,555-0001,first programmer,2024-01-15',
        '2,,No Name Co,,nobody@example.com,,should be skipped,2024-02-01',
        '3,Grace Hopper,Rear Admiral,US Navy,grace@navy.mil,,coined "debugging",2024-03-20',
      ].join('\n'),
      'utf-8'
    );

    const out = runImport();
    expect(out).toContain('Inserted     : 2');
    expect(out).toContain('Skipped      : 1');

    const db = new DatabaseSync(dbPath);
    try {
      const count = (db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c;
      expect(count).toBe(2);

      const ada = db
        .prepare('SELECT * FROM contacts WHERE full_name = ?')
        .get('Ada Lovelace') as { notes: string; connected_on: string; email: string };
      expect(ada.notes).toBe('first programmer'); // icp_reason -> notes
      expect(ada.connected_on).toBe('2024-01-15');
      expect(ada.email).toBe('ada@example.com');

      // The blank-name row must not have been inserted.
      const skipped = db.prepare('SELECT * FROM contacts WHERE company = ?').get('No Name Co');
      expect(skipped).toBeUndefined();
    } finally {
      db.close();
    }
  });

  it('is not idempotent — re-running duplicates rows (documents current behavior)', () => {
    writeFileSync(
      csvPath,
      ['id,full_name', '1,Solo Contact'].join('\n'),
      'utf-8'
    );

    runImport();
    runImport();

    const db = new DatabaseSync(dbPath);
    try {
      const count = (db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c;
      expect(count).toBe(2);
    } finally {
      db.close();
    }
  });
});
