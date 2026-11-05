import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { recToColumns, rowToRec } from '../../src/lib/import';
import { mergeStored, pairProblem, type StoredRow } from '../../src/lib/import/dupes';

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

const stored = (over: Partial<StoredRow>): StoredRow => ({
  id: 1, full_name: 'X', title: null, company: null, email: null, phone: null, alt_emails: null,
  alt_phones: null, urls: null, notes: null, connected_on: null, last_contacted: null, sources: null,
  industry: null, has_photo: 0, photo: null, photo_type: null, ...over,
});

describe('pairProblem', () => {
  it('accepts plain pairs and several drops into one card', () => {
    expect(pairProblem([[1, 2]])).toBeNull();
    expect(pairProblem([[1, 2], [1, 3], [4, 5]])).toBeNull();
  });

  it('refuses chains, repeats and self-merges', () => {
    expect(pairProblem([[1, 2], [2, 3]])).toMatch(/#2 keeps #3 but is itself merged into #1.*1:2 1:3/);
    expect(pairProblem([[1, 2], [3, 1]])).toMatch(/#1 keeps #2 but is itself merged into #3/);
    expect(pairProblem([[1, 2], [1, 2]])).toMatch(/listed twice/);
    expect(pairProblem([[1, 2], [3, 2]])).toMatch(/#2 is merged away twice/);
    expect(pairProblem([[4, 4]])).toMatch(/into itself/);
  });
});

describe('mergeStored', () => {
  it('keeps every email, phone, link, source and the photo of the dropped card', () => {
    const keep = rowToRec(stored({ id: 1, full_name: 'Keep Person', email: 'keep@example.com', urls: 'https://example.com/keep', sources: 'vcard', notes: 'keep note' }));
    const drop = stored({
      id: 2, full_name: 'Drop Person', company: 'Drop Inc', email: 'drop@example.com', alt_emails: 'drop2@example.com',
      phone: '+1 202 555 0181', urls: 'https://example.com/drop', sources: 'other_src,vcard', notes: 'drop note',
      has_photo: 1, photo: PNG, photo_type: 'image/png',
    });
    const { conflicts } = mergeStored(keep, drop, 'US');
    const cols = recToColumns(keep);
    expect(cols).toMatchObject({
      full_name: 'Keep Person', company: 'Drop Inc', email: 'keep@example.com',
      alt_emails: 'drop@example.com\ndrop2@example.com', phone: '+1 202 555 0181',
      urls: 'https://example.com/keep\nhttps://example.com/drop', sources: 'other_src,vcard',
    });
    expect(keep.photo?.type).toBe('image/png');
    expect(conflicts).toEqual(['name: Drop Person']);
    expect(cols.notes).toBe('keep note\ndrop note\nMerged duplicate — also name: Drop Person');
  });

  it('notes disagreeing single values and never replaces a stored photo', () => {
    const keep = rowToRec(stored({ id: 1, full_name: 'Ada Lovelace', company: 'Engines', title: 'Engineer', has_photo: 1 }));
    mergeStored(keep, stored({ id: 2, full_name: 'ada lovelace', company: 'Looms', title: 'engineer', photo: PNG, photo_type: 'image/png' }), 'US');
    expect(keep.photo).toBeNull();
    expect(keep.company).toBe('Engines');
    expect(keep.notes).toBe('Merged duplicate — also company: Looms');
  });
});

// Each test spawns the real scripts through tsx, which is slow on some CI runners.
describe('npm run merge:dupes', { timeout: 60_000 }, () => {
  const ROOT = process.cwd();
  const TSX_CLI = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  let workdir: string;
  let dbPath: string;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'localcontacts-dupes-'));
    dbPath = join(workdir, 'contacts.db');
    // Create the schema the way the app does, then add three cards.
    execFileSync(process.execPath, [TSX_CLI, '-e', "require('./src/lib/db').getDb()"], { cwd: ROOT, env: { ...process.env, CONTACTS_DB_PATH: dbPath } });
    const db = new DatabaseSync(dbPath);
    const add = db.prepare('INSERT INTO contacts (full_name, email, alt_emails, phone, urls, sources, photo, photo_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    add.run('Keep Person', 'keep@example.com', null, null, 'https://example.com/keep', 'vcard', null, null);
    add.run('Drop Person', 'drop@example.com', 'drop2@example.com', '+1 202 555 0181', 'https://example.com/drop', 'other_src,vcard', PNG, 'image/png');
    add.run('Third Person', 'third@example.com', null, null, null, 'csv', null, null);
    db.close();
  }, 60_000);

  afterEach(() => rmSync(workdir, { recursive: true, force: true }));

  const run = (...args: string[]) => {
    try {
      return { status: 0, out: execFileSync(process.execPath, [TSX_CLI, 'scripts/merge-dupes.ts', ...args], { cwd: ROOT, env: { ...process.env, CONTACTS_DB_PATH: dbPath }, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (err) {
      const e = err as { status: number; stdout: string; stderr: string };
      return { status: e.status, out: `${e.stdout}\n${e.stderr}` };
    }
  };
  const rows = () => {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const r = db.prepare('SELECT id, full_name, email, alt_emails, phone, urls, sources, photo_type FROM contacts ORDER BY id').all();
    db.close();
    return r;
  };

  it('refuses a chain and writes nothing', () => {
    const r = run('--apply', '1:2', '2:3');
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/Merge both into the card you keep: 1:2 1:3/);
    expect(rows()).toHaveLength(3);
  });

  it('merges several cards into one, losslessly, after a backup', () => {
    const r = run('--apply', '1:2', '1:3');
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/Backup saved first: .*contacts-.*\.db/);
    expect(readdirSync(join(workdir, 'backups')).filter((f) => f.endsWith('.db'))).toHaveLength(1);
    expect(rows()).toEqual([{
      id: 1, full_name: 'Keep Person', email: 'keep@example.com',
      alt_emails: 'drop@example.com\ndrop2@example.com\nthird@example.com', phone: '+1 202 555 0181',
      urls: 'https://example.com/keep\nhttps://example.com/drop', sources: 'csv,other_src,vcard', photo_type: 'image/png',
    }]);
  });

  it('is a dry run without --apply and answers --help', () => {
    expect(run('1:2').out).toMatch(/dry run — 1 merges/);
    expect(rows()).toHaveLength(3);
    expect(existsSync(join(workdir, 'backups'))).toBe(false);
    expect(run('--help')).toMatchObject({ status: 0, out: expect.stringMatching(/^Usage:/) });
  });
});
