import { existsSync } from 'node:fs';
import { bulkWrite } from '../backups';
import { dbPath, getDb } from '../db';
import { csvHeader, decodeFile, detect, unknownHint } from './detect';
import { defaultSource, parseText } from './index';
import { planMerge, recToColumns, type Batch, type ExistingRow, type MergeStats } from './merge';
import { defaultCountry } from './normalize';
import { normalizeTag } from './tags';
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

// removeSample: delete the sample people (cards tagged only "sample") in the same
// backed-up write, before the import's own changes.
export type ImportOptions = { apply?: boolean; tagOnly?: boolean; backup?: boolean; removeSample?: boolean };

// The tag of the made-up sample people (src/lib/sample.ts). Real contacts are
// never merged into them.
const SAMPLE_TAG = 'sample';

function readFiles(files: ImportFile[]): { reports: FileReport[]; batches: Batch[] } {
  const reports: FileReport[] = [];
  const batches: Batch[] = [];
  for (const f of files) {
    const { text, note } = decodeFile(Buffer.from(f.bytes));
    const format = detect(text);
    if (format === 'unknown') {
      reports.push({ name: f.name, ok: false, warnings: [], error: unknownHint(text, f.name) });
      continue;
    }
    const headers = format === 'generic-csv' ? csvHeader(text).filter(Boolean) : undefined;
    try {
      const res = parseText(text, format, { map: f.map ?? undefined });
      const source = f.source ? normalizeTag(f.source) : defaultSource(format, res.sourceHint);
      batches.push({ source, contacts: res.contacts, explicit: !!f.source });
      reports.push({
        name: f.name,
        ok: true,
        format,
        label: FORMAT_LABELS[format],
        count: res.contacts.length,
        source,
        warnings: note ? [note, ...res.warnings] : res.warnings,
        headers,
      });
    } catch (err) {
      reports.push({ name: f.name, ok: false, format, warnings: [], error: (err as Error).message, headers });
    }
  }
  return { reports, batches };
}

// Backups live in src/lib/backups.ts; re-exported for the scripts that import them from here.
export { backupDatabase } from '../backups';

export function runImport(files: ImportFile[], opts: ImportOptions = {}): ImportReport {
  const country = defaultCountry();
  const { reports, batches } = readFiles(files);
  const empty: ImportReport = {
    ok: false, files: reports, stats: null, before: 0, after: 0, country, applied: false, written: null, backup: null,
  };
  if (files.length === 0 || reports.some((r) => !r.ok)) return empty;

  // A dry run against a database that doesn't exist yet doesn't create it.
  const path = dbPath();
  if (!opts.apply && path !== ':memory:' && !existsSync(path)) {
    const { stats } = planMerge([], batches, { tagOnly: opts.tagOnly, country });
    return { ...empty, ok: true, stats, after: stats.inserted };
  }
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
  // Sample people are left out of matching, so a real "Sam Rivera" never merges
  // into a made-up one (loading the sample itself still merges within it).
  const allSample = batches.every((b) => b.source === SAMPLE_TAG);
  const targets = allSample ? existing : existing.filter((r) => r.sources !== SAMPLE_TAG);
  const { rows, stats } = planMerge(targets, batches, { tagOnly: opts.tagOnly, country });
  const sampleCards = existing.length - targets.length;
  const report: ImportReport = {
    ok: true, files: reports, stats, before, after: before + stats.inserted - (opts.removeSample ? sampleCards : 0),
    country, applied: false, written: null, backup: null,
  };
  if (!opts.apply) return report;

  const removeSample = !!opts.removeSample && sampleCards > 0;
  const changes = removeSample || rows.some((r) => r.id === null || r.dirty);
  const detail = files.map((f) => f.name).join(', ');
  const { result, backup } = bulkWrite(
    'import',
    detail,
    (tx) => {
      const insert = tx.prepare(`
        INSERT INTO contacts (full_name, title, company, email, phone, alt_emails, alt_phones, urls,
                              notes, connected_on, last_contacted, industry, sources)
        VALUES (@full_name, @title, @company, @email, @phone, @alt_emails, @alt_phones, @urls,
                @notes, @connected_on, @last_contacted, @industry, @sources)
      `);
      const update = tx.prepare(`
        UPDATE contacts SET
          full_name = @full_name, title = @title, company = @company, email = @email, phone = @phone,
          alt_emails = @alt_emails, alt_phones = @alt_phones, urls = @urls, notes = @notes,
          connected_on = @connected_on, last_contacted = @last_contacted, industry = @industry, sources = @sources,
          updated_at = datetime('now')
        WHERE id = @id
      `);
      const photo = tx.prepare(`UPDATE contacts SET photo = ?, photo_type = ? WHERE id = ?`);
      let inserted = 0;
      let updated = 0;
      if (removeSample) tx.prepare('DELETE FROM contacts WHERE sources = ?').run(SAMPLE_TAG);
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
      return { inserted, updated };
    },
    { backup: opts.backup !== false && changes }
  );
  report.backup = backup;
  report.written = result;
  report.applied = true;
  report.after = count();
  return report;
}
