import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb, getDb } from '../src/lib/db';
import { createContact, listVersion } from '../src/lib/contacts';
import { backupDatabase, bulkWrite, isBackupName, listBackups } from '../src/lib/backups';
import { runImport } from '../src/lib/import/run';
import pkg from '../package.json';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'localcontacts-backups-'));
  process.env.CONTACTS_DB_PATH = join(dir, 'contacts.db');
  closeDb();
});
afterEach(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

const count = () => (getDb().prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c;

describe('backups', () => {
  it('save a record of why they were taken next to each copy', () => {
    createContact({ full_name: 'Ada Lovelace' });
    const file = backupDatabase('merge', '1:2')!;
    const record = JSON.parse(readFileSync(file.replace(/\.db$/, '.json'), 'utf-8'));
    expect(record).toMatchObject({ reason: 'merge', detail: '1:2', cards: 1, appVersion: pkg.version, after: null });
    expect(Date.parse(record.at)).toBeGreaterThan(Date.now() - 60_000);
    expect(isBackupName(file.split(/[\\/]/).pop()!)).toBe(true);
  });

  it('are listed newest first, and a 1.0 backup without a record still shows its date', () => {
    createContact({ full_name: 'Ada Lovelace' });
    const first = backupDatabase('import', 'a.vcf')!;
    const second = backupDatabase('names', null)!;
    copyFileSync(first, join(dir, 'backups', 'contacts-20250101-090000.db'));
    const list = listBackups();
    expect(list.map((b) => b.record?.reason ?? null)).toEqual(['names', 'import', null]);
    expect(list[0].name).toBe(second.split(/[\\/]/).pop());
    expect(list[2]).toMatchObject({ name: 'contacts-20250101-090000.db', record: null, at: new Date(2025, 0, 1, 9, 0, 0).toISOString() });
    expect(list[2].size).toBeGreaterThan(0);
  });

  it('refuse names that are not ours', () => {
    for (const bad of ['../contacts.db', 'contacts.db', 'contacts-2026-11-04.db', 'contacts-20261104-180800.db/../x', 'contacts-20261104-180800a.db']) {
      expect(isBackupName(bad), bad).toBe(false);
    }
    expect(isBackupName('contacts-20261104-180800b.db')).toBe(true);
    expect(isBackupName('contacts-20261104-180800z25.db')).toBe(true);
  });
});

describe('bulkWrite', () => {
  it('backs up, writes in one transaction, and notes the state reached', () => {
    createContact({ full_name: 'Ada Lovelace' });
    const { result, backup } = bulkWrite('names', 'tidy', (db) => {
      db.prepare("UPDATE contacts SET full_name = 'Ada King'").run();
      return 'done';
    });
    expect(result).toBe('done');
    const record = JSON.parse(readFileSync(backup!.replace(/\.db$/, '.json'), 'utf-8'));
    expect(record.after).toBe(listVersion());
  });

  it('rolls everything back when the write fails, and keeps the backup', () => {
    createContact({ full_name: 'Ada Lovelace' });
    expect(() =>
      bulkWrite('merge', null, (db) => {
        db.prepare('DELETE FROM contacts').run();
        throw new Error('stop');
      })
    ).toThrow('stop');
    expect(count()).toBe(1);
    expect(listBackups()).toHaveLength(1);
  });
});

describe('imports', () => {
  it('label their backup with the files they read', () => {
    createContact({ full_name: 'Someone Already Here' });
    const file = { name: 'friends.csv', bytes: Buffer.from('Name,Email\nNew Person,new@example.com\n') };
    const r = runImport([file], { apply: true });
    expect(r.written).toEqual({ inserted: 1, updated: 0 });
    const [b] = listBackups();
    expect(b.record).toMatchObject({ reason: 'import', detail: 'friends.csv', cards: 1 });
    expect(b.record!.after).toBe(listVersion());
  });
});
