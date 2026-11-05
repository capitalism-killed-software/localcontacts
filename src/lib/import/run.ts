import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dbPath, getDb } from '../db';
import { csvHeader, decodeFileBytes, detect, unknownHint } from './detect';
import { defaultSource, parseText } from './index';
import { planMerge, recToColumns, type Batch, type ExistingRow, type MergeStats } from './merge';
import { defaultCountry } from './normalize';
import type { FieldMap } from './fields';
import { FORMAT_LABELS, type Format } from './types';

// One import run, used by both the command line and the import page: read
// every file, stop before touching the database if any of them can't be
// read, plan the merge, and (with apply) back up the database and write.

export type ImportFile = { name: string; bytes: Uint8Array; source?: string | null; map?: FieldMap | null };

export type FileReport = {
  name: string;
  ok: boolean;
  format?: Format;
  label?: string;
  count?: number;
  source?: string;
  warnings: string[];
  error?: string;
  headers?: string[]; // a generic CSV's columns, so the page can offer mapping
};

export type ImportReport = {
  ok: boolean;
  files: FileReport[];
  stats: MergeStats | null;
  before: number;
  after: number;
  country: string;
  applied: boolean;
  written: { inserted: number; updated: number } | null;
  backup: string | null;
};

export type ImportOptions = { apply?: boolean; tagOnly?: boolean; backup?: boolean };

function readFiles(files: ImportFile[]): { reports: FileReport[]; batches: Batch[] } {
  const reports: FileReport[] = [];
  const batches: Batch[] = [];
  for (const f of files) {
    const text = decodeFileBytes(Buffer.from(f.bytes));
    const format = detect(text);
    if (format === 'unknown') {
      reports.push({ name: f.name, ok: false, warnings: [], error: unknownHint(text, f.name) });
      continue;
    }
    const headers = format === 'generic-csv' ? csvHeader(text).filter(Boolean) : undefined;
    try {
      const res = parseText(text, format, { map: f.map ?? undefined });
      const source = f.source || defaultSource(format, res.sourceHint);
      batches.push({ source, contacts: res.contacts, explicit: !!f.source });
      reports.push({
        name: f.name,
        ok: true,
        format,
        label: FORMAT_LABELS[format],
        count: res.contacts.length,
        source,
        warnings: res.warnings,
        headers,
      });
    } catch (err) {
      reports.push({ name: f.name, ok: false, format, warnings: [], error: (err as Error).message, headers });
    }
  }
  return { reports, batches };
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

// A consistent copy of the database next to it, in data/backups/.
export function backupDatabase(): string | null {
  const path = dbPath();
  if (path === ':memory:') return null;
  const dir = join(dirname(path), 'backups');
  mkdirSync(dir, { recursive: true });
  const base = join(dir, `contacts-${stamp()}`);
  let target = `${base}.db`;
  for (let n = 2; existsSync(target); n++) target = `${base}-${n}.db`;
  getDb().exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  return target;
}

export function runImport(files: ImportFile[], opts: ImportOptions = {}): ImportReport {
  const country = defaultCountry();
  const { reports, batches } = readFiles(files);
  const empty: ImportReport = {
    ok: false, files: reports, stats: null, before: 0, after: 0, country, applied: false, written: null, backup: null,
  };
  if (files.length === 0 || reports.some((r) => !r.ok)) return empty;

  const db = getDb();
  const count = () => (db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c;
  const before = count();
  const existing = db
    .prepare(
      `SELECT id, full_name, title, company, email, phone, alt_emails, alt_phones, urls,
              notes, connected_on, last_contacted, sources, industry, (photo_type IS NOT NULL) AS has_photo
       FROM contacts`
    )
    .all() as unknown as ExistingRow[];
  const { rows, stats } = planMerge(existing, batches, { tagOnly: opts.tagOnly, country });
  const report: ImportReport = {
    ok: true, files: reports, stats, before, after: before + stats.inserted, country, applied: false, written: null, backup: null,
  };
  if (!opts.apply) return report;

  if (opts.backup !== false && rows.some((r) => r.id === null || r.dirty)) report.backup = backupDatabase();

  const insert = db.prepare(`
    INSERT INTO contacts (full_name, title, company, email, phone, alt_emails, alt_phones, urls,
                          notes, connected_on, last_contacted, industry, sources)
    VALUES (@full_name, @title, @company, @email, @phone, @alt_emails, @alt_phones, @urls,
            @notes, @connected_on, @last_contacted, @industry, @sources)
  `);
  const update = db.prepare(`
    UPDATE contacts SET
      full_name = @full_name, title = @title, company = @company, email = @email, phone = @phone,
      alt_emails = @alt_emails, alt_phones = @alt_phones, urls = @urls, notes = @notes,
      connected_on = @connected_on, last_contacted = @last_contacted, industry = @industry, sources = @sources,
      updated_at = datetime('now')
    WHERE id = @id
  `);
  const photo = db.prepare(`UPDATE contacts SET photo = ?, photo_type = ? WHERE id = ?`);

  let inserted = 0;
  let updated = 0;
  db.exec('BEGIN');
  try {
    for (const r of rows) {
      let id = r.id;
      if (id === null) {
        id = Number(insert.run(recToColumns(r)).lastInsertRowid);
        inserted++;
      } else if (r.dirty) {
        update.run({ id, ...recToColumns(r) });
        updated++;
      } else continue;
      if (r.photo) photo.run(r.photo.data, r.photo.type, id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  if (dbPath() !== ':memory:') db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  report.applied = true;
  report.written = { inserted, updated };
  report.after = count();
  return report;
}
