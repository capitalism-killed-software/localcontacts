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
 *   --no-backup        with --apply, skip the copy of the database normally saved to
 *                      data/backups/ before writing
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
import { parseFieldMap, type FieldMap } from '../src/lib/import';
import { runImport, type ImportFile } from '../src/lib/import/run';

type FileArg = { path: string; source: string | null; map: FieldMap | null };

const USAGE =
  'Usage: npm run import -- [--apply] [--source=<tag>] [--map=<spec>] [--country=<CC>] [--tag-only] [--no-backup] <file> ...';

function parseArgs(argv: string[]) {
  let apply = false;
  let tagOnly = false;
  let backup = true;
  let source: string | null = null;
  let map: FieldMap | null = null;
  const files: FileArg[] = [];
  for (const a of argv) {
    if (a === '--apply') apply = true;
    else if (a === '--tag-only') tagOnly = true;
    else if (a === '--no-backup') backup = false;
    else if (a === '--help' || a === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else if (a.startsWith('--source=')) source = a.slice('--source='.length).trim() || null;
    else if (a.startsWith('--map=')) map = parseFieldMap(a.slice('--map='.length));
    else if (a.startsWith('--country=')) process.env.CONTACTS_DEFAULT_COUNTRY = a.slice('--country='.length);
    else if (a.startsWith('--')) {
      console.error(`Unknown option ${a}\n${USAGE}`);
      process.exit(1);
    } else files.push({ path: resolve(a.replace(/^~(?=[/\\]|$)/, process.env.HOME ?? process.env.USERPROFILE ?? '~')), source, map });
  }
  if (files.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }
  return { apply, tagOnly, backup, files };
}

function main() {
  const { apply, tagOnly, backup, files } = parseArgs(process.argv.slice(2));

  const inputs: ImportFile[] = [];
  for (const f of files) {
    if (!existsSync(f.path)) {
      console.error(`✗ ${basename(f.path)}: file not found (${f.path})`);
      console.error('\nNothing was written. Fix the files above and re-run.');
      process.exit(1);
    }
    inputs.push({ name: basename(f.path), bytes: readFileSync(f.path), source: f.source, map: f.map });
  }

  const r = runImport(inputs, { apply, tagOnly, backup });
  for (const f of r.files) {
    if (f.ok) {
      console.log(`✓ ${f.name}: ${f.label}, ${f.count} contacts, tagged "${f.source}"`);
      for (const w of f.warnings) console.log(`    note: ${w}`);
    } else console.error(`✗ ${f.name}: ${f.error}`);
  }
  if (!r.ok || !r.stats) {
    console.error('\nNothing was written. Fix the files above and re-run.');
    process.exit(1);
  }

  const st = r.stats;
  console.log('');
  console.log('Contacts in files      :', st.incoming);
  console.log('New contacts           :', st.inserted);
  console.log('Merged into existing   :', st.mergedIntoExisting);
  console.log('Merged within files    :', st.mergedWithinImport);
  if (tagOnly) console.log('Skipped (tag-only)     :', st.skippedUnmatched);
  console.log('Emails added           :', st.addedEmails, `(${st.filledEmail} contacts gained their first)`);
  console.log('Phones added           :', st.addedPhones, `(${st.filledPhone} contacts gained their first)`);
  console.log('Photos added           :', st.addedPhotos);
  console.log('Phone country          :', r.country);
  console.log('DB before / after      :', `${r.before} / ${r.before + st.inserted}`);

  if (!r.applied) {
    console.log('\nDry run: nothing written. Re-run with --apply to write (a backup is saved first).');
    return;
  }
  if (r.backup) console.log(`\nBackup saved to ${r.backup}`);
  console.log(`\nWritten: ${r.written!.inserted} inserted, ${r.written!.updated} updated.`);
}

main();
