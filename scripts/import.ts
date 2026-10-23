/**
 * Import contact exports into the local database.
 *
 * Usage:
 *   npm run import -- [options] <file> [<file> ...]
 *
 * Options:
 *   --apply            write to the database (default: dry run that only reports)
 *   --source=<tag>     origin tag for the files that follow (default: inferred from each file)
 *   --map=<spec>       column mapping for the generic CSV files that follow,
 *                      e.g. --map=full_name=Name,email=Email,phone=Mobile
 *   --country=<CC>     country for phone numbers written without a + prefix
 *                      (default: CONTACTS_DEFAULT_COUNTRY, else US)
 *   --tag-only         only add the source tag to contacts that already match; never
 *                      insert or change anything else
 *
 * Formats are recognised from the file contents, not the extension: vCard 2.1/3.0/4.0
 * (Apple, Google, Proton, Android, Outlook, Thunderbird), Google Contacts CSV (both
 * layouts), Outlook CSV, LinkedIn Connections.csv, Telegram result.json, and any CSV
 * with a header row. A file that cannot be recognised stops the run with a hint and
 * nothing is written. Files are never modified.
 *
 * Matching: a contact is the same person as an existing row when any email matches,
 * else any phone number (normalised, so "(202) 555-0101" and "+12025550101" agree),
 * else the normalised full name. Matches fill empty fields and add further emails,
 * phones and links; nothing already stored is overwritten.
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { getDb } from '../src/lib/db';
import {
  decodeFileBytes,
  defaultCountry,
  defaultSource,
  detect,
  FORMAT_LABELS,
  parseFieldMap,
  parseText,
  planMerge,
  recToColumns,
  unknownHint,
  type Batch,
  type ExistingRow,
  type FieldMap,
} from '../src/lib/import';

type FileArg = { path: string; source: string | null; map: FieldMap | null };

const USAGE =
  'Usage: npm run import -- [--apply] [--source=<tag>] [--map=<spec>] [--country=<CC>] [--tag-only] <file> ...';

function parseArgs(argv: string[]) {
  let apply = false;
  let tagOnly = false;
  let source: string | null = null;
  let map: FieldMap | null = null;
  const files: FileArg[] = [];
  for (const a of argv) {
    if (a === '--apply') apply = true;
    else if (a === '--tag-only') tagOnly = true;
    else if (a === '--help' || a === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else if (a.startsWith('--source=')) source = a.slice('--source='.length).trim() || null;
    else if (a.startsWith('--map=')) map = parseFieldMap(a.slice('--map='.length));
    else if (a.startsWith('--country=')) process.env.CONTACTS_DEFAULT_COUNTRY = a.slice('--country='.length);
    else if (a.startsWith('--')) {
      console.error(`Unknown option ${a}\n${USAGE}`);
      process.exit(1);
    } else files.push({ path: resolve(a.replace(/^~(?=\/|$)/, process.env.HOME ?? '~')), source, map });
  }
  if (files.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }
  return { apply, tagOnly, files };
}

function main() {
  const { apply, tagOnly, files } = parseArgs(process.argv.slice(2));
  const country = defaultCountry();

  // Read and parse every file before touching the database, so a bad file
  // stops the whole run.
  const batches: Batch[] = [];
  let failed = false;
  for (const f of files) {
    const label = basename(f.path);
    if (!existsSync(f.path)) {
      console.error(`✗ ${label}: file not found (${f.path})`);
      failed = true;
      continue;
    }
    const text = decodeFileBytes(readFileSync(f.path));
    const format = detect(text);
    if (format === 'unknown') {
      console.error(`✗ ${label}: ${unknownHint(text, f.path)}`);
      failed = true;
      continue;
    }
    try {
      const res = parseText(text, format, { map: f.map ?? undefined });
      const source = f.source ?? defaultSource(format, res.sourceHint);
      batches.push({ source, contacts: res.contacts });
      console.log(`✓ ${label}: ${FORMAT_LABELS[format]}, ${res.contacts.length} contacts, tagged "${source}"`);
      for (const w of res.warnings) console.log(`    note: ${w}`);
    } catch (err) {
      console.error(`✗ ${label}: ${(err as Error).message}`);
      failed = true;
    }
  }
  if (failed) {
    console.error('\nNothing was written. Fix the files above and re-run.');
    process.exit(1);
  }

  const db = getDb();
  const before = (db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c;
  const existing = db
    .prepare(
      `SELECT id, full_name, title, company, email, phone, alt_emails, alt_phones, urls,
              notes, connected_on, last_contacted, sources
       FROM contacts`
    )
    .all() as unknown as ExistingRow[];

  const { rows, stats } = planMerge(existing, batches, { tagOnly, country });

  console.log('');
  console.log('Contacts in files      :', stats.incoming);
  console.log('New contacts           :', stats.inserted);
  console.log('Merged into existing   :', stats.mergedIntoExisting);
  console.log('Merged within files    :', stats.mergedWithinImport);
  if (tagOnly) console.log('Skipped (tag-only)     :', stats.skippedUnmatched);
  console.log('Emails added           :', stats.addedEmails, `(${stats.filledEmail} contacts gained their first)`);
  console.log('Phones added           :', stats.addedPhones, `(${stats.filledPhone} contacts gained their first)`);
  console.log('Phone country          :', country);
  console.log('DB before / after      :', `${before} / ${before + stats.inserted}`);

  if (!apply) {
    console.log('\nDry run: nothing written. Back up data/contacts.db, then re-run with --apply.');
    return;
  }

  const insert = db.prepare(`
    INSERT INTO contacts (full_name, title, company, email, phone, alt_emails, alt_phones, urls,
                          notes, connected_on, last_contacted, sources)
    VALUES (@full_name, @title, @company, @email, @phone, @alt_emails, @alt_phones, @urls,
            @notes, @connected_on, @last_contacted, @sources)
  `);
  const update = db.prepare(`
    UPDATE contacts SET
      full_name = @full_name, title = @title, company = @company, email = @email, phone = @phone,
      alt_emails = @alt_emails, alt_phones = @alt_phones, urls = @urls, notes = @notes,
      connected_on = @connected_on, last_contacted = @last_contacted, sources = @sources,
      updated_at = datetime('now')
    WHERE id = @id
  `);

  let inserted = 0;
  let updated = 0;
  db.exec('BEGIN');
  try {
    for (const r of rows) {
      if (r.id === null) {
        insert.run(recToColumns(r));
        inserted++;
      } else if (r.dirty) {
        update.run({ id: r.id, ...recToColumns(r) });
        updated++;
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log(`\nWritten: ${inserted} inserted, ${updated} updated.`);
}

main();
