import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { dbPath, getDb, migrateData } from './db';
import pkg from '../../package.json';

// Backups of the whole database, saved next to it in backups/ before anything
// writes in bulk (an import, a merge, a clean-up, a restore). Each backup has a
// small record beside it (contacts-….json) saying why it was taken, so the
// backups sheet can show "Before importing google.vcf" and "Undo" can find the
// right one. Backups from 1.0 have no record; their date comes from the name.

export type BackupReason = 'import' | 'merge' | 'names' | 'industries' | 'sample' | 'restore';

export type BackupRecord = {
  reason: BackupReason;
  detail: string | null;
  at: string; // when it was taken, UTC ISO (the file name is in local time)
  cards: number;
  appVersion: string;
  after: string | null; // listVersion() once the write that followed it finished
};

export type BackupEntry = {
  name: string; // contacts-20261104-180800.db
  size: number;
  record: BackupRecord | null;
  at: string; // from the record, or from the file name
};

const NAME = /^contacts-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:[b-y]|z\d+)?\.db$/;

/** Whether a name is one of ours (no paths, nothing else). */
export const isBackupName = (name: string): boolean => NAME.test(name);

/** When a backup was taken, read from its name (local time). */
function dateFromName(name: string): Date | null {
  const m = name.match(NAME);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}

/** A date and time as the person reads it, in this computer's language. */
export const formatWhen = (d: Date | string): string =>
  new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** What a backup was taken before, in plain words for the backups sheet. */
export function describeBackup(entry: BackupEntry): string {
  const r = entry.record;
  if (!r) return 'Backup';
  switch (r.reason) {
    case 'import':
      return r.detail ? `Before importing ${r.detail}` : 'Before an import';
    case 'merge':
      return 'Before merging duplicates';
    case 'names':
      return 'Before tidying names';
    case 'industries':
      return 'Before filling in industries';
    case 'sample':
      return 'Before removing the sample people';
    case 'restore': {
      const when = r.detail ? dateFromName(r.detail) : null;
      return when ? `Before restoring the backup from ${formatWhen(when)}` : 'Before restoring a backup';
    }
    default:
      return 'Backup';
  }
}

/** The backups folder next to the database, or null for an in-memory database. */
export function backupsDir(): string | null {
  const path = dbPath();
  return path === ':memory:' ? null : join(dirname(path), 'backups');
}

// Local time, as the user reads it when picking a backup: 20261104-180800.
const stamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

const recordPath = (dbFile: string) => dbFile.replace(/\.db$/, '.json');

const cardCount = (db: DatabaseSync) => (db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c;

/** A consistent copy of the database in backups/, with its record. Returns the file's path. */
export function backupDatabase(reason: BackupReason = 'import', detail: string | null = null): string | null {
  const dir = backupsDir();
  if (!dir) return null;
  mkdirSync(dir, { recursive: true });
  const now = new Date();
  const base = join(dir, `contacts-${stamp(now)}`);
  // A second backup in the same second gets a letter (…-180800b.db), which sorts after the first.
  const letters = 'bcdefghijklmnopqrstuvwxy';
  let target = `${base}.db`;
  for (let n = 0; existsSync(target); n++) target = `${base}${n < letters.length ? letters[n] : `z${n}`}.db`;
  const db = getDb();
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  const record: BackupRecord = { reason, detail, at: now.toISOString(), cards: cardCount(db), appVersion: pkg.version, after: null };
  writeFileSync(recordPath(target), JSON.stringify(record, null, 2) + '\n');
  return target;
}

function readRecord(dbFile: string): BackupRecord | null {
  try {
    return JSON.parse(readFileSync(recordPath(dbFile), 'utf-8')) as BackupRecord;
  } catch {
    return null;
  }
}

/** Notes the state the database reached after the write that followed a backup. */
export function finishBackup(dbFile: string, after: string): void {
  const record = readRecord(dbFile);
  if (record) writeFileSync(recordPath(dbFile), JSON.stringify({ ...record, after }, null, 2) + '\n');
}

/** Every backup, newest first. */
export function listBackups(): BackupEntry[] {
  const dir = backupsDir();
  if (!dir || !existsSync(dir)) return [];
  const out: BackupEntry[] = [];
  for (const name of readdirSync(dir)) {
    const m = name.match(NAME);
    if (!m) continue;
    const file = join(dir, name);
    const record = readRecord(file);
    out.push({ name, size: statSync(file).size, record, at: record?.at ?? dateFromName(name)!.toISOString() });
  }
  // Newest first; within one second, the lettered names come after the plain one.
  return out.sort((a, b) => (a.at === b.at ? b.name.localeCompare(a.name) : b.at.localeCompare(a.at)));
}

export function listVersionOf(db: DatabaseSync): string {
  const row = db.prepare('SELECT COUNT(*) AS c, MAX(id) AS m, MAX(updated_at) AS u FROM contacts').get() as {
    c: number;
    m: number | null;
    u: string | null;
  };
  return `${row.c}.${row.m ?? 0}.${row.u ?? ''}`;
}

/**
 * A write in bulk: a backup first (unless asked not to), then `fn` inside one
 * transaction, rolled back if it throws. The backup's record notes the state
 * the database reached, so "Undo" can tell whether anything changed since.
 */
export function bulkWrite<T>(
  reason: BackupReason,
  detail: string | null,
  fn: (db: DatabaseSync) => T,
  opts: { backup?: boolean } = {}
): { result: T; backup: string | null } {
  const backup = opts.backup === false ? null : backupDatabase(reason, detail);
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  let result: T;
  try {
    result = fn(db);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  if (dbPath() !== ':memory:') db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  if (backup) finishBackup(backup, listVersionOf(db));
  return { result, backup };
}

const fileOf = (name: string): string => {
  const dir = backupsDir();
  if (!dir || !isBackupName(name)) throw new Error('That is not a backup of this book.');
  const file = join(dir, name);
  if (!existsSync(file)) throw new Error('That backup is no longer there.');
  return file;
};

const columnsOf = (db: DatabaseSync, schema: string): string[] =>
  (db.prepare(`PRAGMA ${schema}.table_info(contacts)`).all() as Array<{ name: string }>).map((c) => c.name);

const busy = (err: unknown): Error =>
  /locked|busy/i.test(String((err as Error)?.message))
    ? new Error('The database is busy (another program is writing to it). Try again in a moment.')
    : (err as Error);

/**
 * Puts the book back as it was in a backup. The current state is saved first
 * (as a "restore" backup), then the backup's cards replace the current ones in
 * one transaction on the open connection: the database file itself is never
 * swapped, which would be unsafe while the app has it open (and impossible on
 * Windows). Card ids keep counting up, so an id is never reused.
 */
export function restoreBackup(name: string): { saved: string | null; cards: number } {
  const file = fileOf(name);
  // Check it reads as a contacts database before touching anything.
  const src = new DatabaseSync(file, { readOnly: true });
  try {
    const check = src.prepare('PRAGMA quick_check').get() as Record<string, string>;
    if (Object.values(check)[0] !== 'ok') throw new Error('That backup is damaged.');
    const cols = columnsOf(src, 'main');
    if (!cols.includes('id') || !cols.includes('full_name')) throw new Error('That file is not a contacts backup.');
  } finally {
    src.close();
  }

  const saved = backupDatabase('restore', name);
  const db = getDb();
  db.prepare('ATTACH DATABASE ? AS b').run(file);
  try {
    const have = new Set(columnsOf(db, 'b'));
    const shared = columnsOf(db, 'main').filter((c) => have.has(c)).map((c) => `"${c}"`).join(', ');
    try {
      db.exec('BEGIN IMMEDIATE');
    } catch (err) {
      throw busy(err);
    }
    try {
      db.exec('DELETE FROM main.contacts');
      db.exec(`INSERT INTO main.contacts (${shared}) SELECT ${shared} FROM b.contacts`);
      // The "not the same person" choices go back as they were too (none before 1.1).
      db.exec('DELETE FROM main.not_duplicates');
      if (db.prepare(`SELECT 1 FROM b.sqlite_master WHERE type = 'table' AND name = 'not_duplicates'`).get()) {
        db.exec('INSERT INTO main.not_duplicates (a, b) SELECT a, b FROM b.not_duplicates');
      }
      migrateData(db);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw busy(err);
    }
  } finally {
    db.exec('DETACH DATABASE b');
  }
  if (dbPath() !== ':memory:') db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  if (saved) finishBackup(saved, listVersionOf(db));
  return { saved, cards: (db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c };
}

/** Deletes a backup and its record. */
export function deleteBackup(name: string): void {
  const file = fileOf(name);
  rmSync(file, { force: true });
  rmSync(recordPath(file), { force: true });
}

/**
 * The newest import that can be undone, and whether anything changed since it
 * (then undoing it also undoes those later changes, which are saved first).
 * None once a restore came after it: the book was already put back.
 */
export function lastImport(): { entry: BackupEntry; changedSince: boolean } | null {
  const entry = listBackups().find((b) => b.record?.reason === 'import' || b.record?.reason === 'restore');
  if (!entry || entry.record!.reason !== 'import' || !entry.record!.after) return null;
  return { entry, changedSince: listVersionOf(getDb()) !== entry.record!.after };
}
