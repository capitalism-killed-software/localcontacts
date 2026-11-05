/**
 * Tidy contacts whose display name is an email address or junk (a side effect of
 * Google/iCloud exports). Strategy, in order of preference:
 *   1. Strip a "Real Name (email@x.com)" or "Real Name" <email@x.com> wrapper -> "Real Name".
 *   2. Strip a "Name @ Company" suffix -> "Name", when the card has no company yet
 *      (it gets that one) or the same company.
 *   3. Derive "First Last" from a first.last@ / first_last@ address.
 *   4. Otherwise fall back to the bare email address (cleaner than the wrapper).
 *
 * A name is only changed when we can produce something strictly better, and nothing
 * is lost: an address that appears only in the name is added to the card's emails.
 * A backup of the database is saved to data/backups/ before writing.
 *
 * Usage:
 *   npm run clean:names            # dry run: prints proposed changes only
 *   npm run clean:names -- --apply # write the changes
 */
import { getDb } from '../src/lib/db';
import { emailLike, proposeNameFix, type NameFix, type NameRow } from '../src/lib/clean-names';
import { backupDatabase } from '../src/lib/import/run';

const USAGE = 'Usage: npm run clean:names [-- --apply]';
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}
const unknown = args.filter((a) => a !== '--apply');
if (unknown.length) {
  console.error(`Unknown option ${unknown[0]}.\n${USAGE}`);
  process.exit(1);
}
const APPLY = args.includes('--apply');

function main() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, full_name, email, alt_emails, company FROM contacts
       WHERE full_name LIKE '%@%' OR full_name = '(no name)'
       ORDER BY full_name`
    )
    .all() as Array<NameRow & { id: number }>;

  const changes: Array<{ row: NameRow & { id: number }; fix: NameFix }> = [];
  for (const row of rows) {
    const fix = proposeNameFix(row);
    if (fix) changes.push({ row, fix });
  }

  const derived = changes.filter((c) => !emailLike(c.fix.name)).length;
  console.log(`Candidates (email/junk names): ${rows.length}`);
  console.log(`Proposed changes             : ${changes.length}`);
  console.log(`  → real name derived        : ${derived}`);
  console.log(`  → cleaned to bare email    : ${changes.length - derived}`);
  console.log(`Unchanged (already clean-ish): ${rows.length - changes.length}`);
  console.log('');
  for (const { row, fix } of changes) {
    const tag = emailLike(fix.name) ? 'email' : 'NAME ';
    const extra = [
      fix.addEmails.length ? `keeps ${fix.addEmails.join(', ')} as an email` : '',
      fix.company ? `company: ${fix.company}` : '',
    ].filter(Boolean);
    console.log(`  [${tag}] "${row.full_name}"  ->  "${fix.name}"${extra.length ? `  (${extra.join('; ')})` : ''}`);
  }

  if (!APPLY) {
    console.log('\n(dry run — re-run with --apply to write these changes)');
    return;
  }
  if (changes.length === 0) return;

  const backup = backupDatabase();
  const upd = db.prepare(
    `UPDATE contacts SET full_name = ?, email = ?, alt_emails = ?, company = ?, updated_at = datetime('now') WHERE id = ?`
  );
  db.exec('BEGIN');
  try {
    for (const { row, fix } of changes) {
      const emails = [row.email, ...(row.alt_emails ?? '').split('\n'), ...fix.addEmails]
        .map((e) => (e ?? '').trim())
        .filter(Boolean);
      upd.run(fix.name, emails[0] ?? null, emails.slice(1).join('\n') || null, row.company ?? fix.company, row.id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log(`\nApplied ${changes.length} updates.`);
  if (backup) console.log(`Backup saved first: ${backup}`);
}

main();
