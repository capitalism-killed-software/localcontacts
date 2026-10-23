import { parse } from 'csv-parse/sync';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb } from '../src/lib/db';

type Row = {
  id?: string;
  full_name?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  icp_reason?: string;
  connected_on?: string;
};

function blankToNull(v: string | undefined | null): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run import -- <file.csv>');
    process.exit(1);
  }
  const csvPath = resolve(arg);
  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }
  const raw = readFileSync(csvPath, 'utf-8');
  const rows: Row[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  const db = getDb();
  const before = (db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c;

  const insert = db.prepare(`
    INSERT INTO contacts (full_name, title, company, email, phone, notes, connected_on)
    VALUES (@full_name, @title, @company, @email, @phone, @notes, @connected_on)
  `);

  let inserted = 0;
  let skipped = 0;
  db.exec('BEGIN');
  try {
    for (const r of rows) {
      const full_name = blankToNull(r.full_name);
      if (!full_name) {
        skipped++;
        continue;
      }
      insert.run({
        full_name,
        title: blankToNull(r.title),
        company: blankToNull(r.company),
        email: blankToNull(r.email),
        phone: blankToNull(r.phone),
        notes: blankToNull(r.icp_reason),
        connected_on: blankToNull(r.connected_on),
      });
      inserted++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  const result = { inserted, skipped };
  const after = (db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c;

  console.log(`Source       : ${csvPath}`);
  console.log(`Rows parsed  : ${rows.length}`);
  console.log(`Inserted     : ${result.inserted}`);
  console.log(`Skipped      : ${result.skipped} (no full_name)`);
  console.log(`DB before    : ${before}`);
  console.log(`DB after     : ${after}`);
}

main();
