/**
 * Merge explicit duplicate contact rows (keep <- drop). The dropped card is merged
 * into the kept one the way an import merges: gaps are filled, every email, phone,
 * link and source is kept, its note is added, and its photo fills an empty frame.
 * Single values that disagree (another name, company, title, ...) are written into
 * the kept card's note, so nothing is lost. The dropped card is then deleted, after
 * a backup of the database is saved to data/backups/.
 *
 * Pairs are given explicitly by id, with no fuzzy name matching, because deciding
 * "same person" needs human judgment: two different people can share a name.
 *
 * Usage:
 *   npm run merge:dupes -- 12:34 12:35 56:78          # dry run
 *   npm run merge:dupes -- --apply 12:34 12:35 56:78  # write
 *
 * Each argument is keepId:dropId. Keep the row with the better primary email. To
 * merge three cards into one, name the kept card in both pairs (12:34 12:35).
 */
import { getDb } from '../src/lib/db';
import { defaultCountry, recToColumns, rowToRec, type Rec } from '../src/lib/import';
import { mergeStored, pairProblem, type Pair, type StoredRow } from '../src/lib/import/dupes';
import { backupDatabase } from '../src/lib/import/run';

const USAGE = 'Usage: npm run merge:dupes -- [--apply] keepId:dropId [keepId:dropId ...]';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}
const unknown = args.filter((a) => a.startsWith('-') && a !== '--apply');
if (unknown.length) fail(`Unknown option ${unknown[0]}.\n${USAGE}`);
const APPLY = args.includes('--apply');

function parsePairs(list: string[]): Pair[] {
  const pairs: Pair[] = [];
  for (const a of list) {
    const m = a.match(/^(\d+):(\d+)$/);
    if (!m) fail(`Bad argument "${a}": expected keepId:dropId`);
    pairs.push([Number(m[1]), Number(m[2])]);
  }
  if (pairs.length === 0) fail(USAGE);
  const problem = pairProblem(pairs);
  if (problem) fail(problem);
  return pairs;
}

const PAIRS = parsePairs(args.filter((a) => !a.startsWith('-')));

function main() {
  const db = getDb();
  const country = defaultCountry();
  const get = db.prepare(
    `SELECT id, full_name, title, company, email, phone, alt_emails, alt_phones, urls, notes,
            connected_on, last_contacted, sources, industry, photo IS NOT NULL AS has_photo, photo, photo_type
       FROM contacts WHERE id = ?`
  );
  const load = (id: number) => get.get(id) as StoredRow | undefined;

  const kept = new Map<number, Rec>();
  const drops: number[] = [];
  for (const [keepId, dropId] of PAIRS) {
    const keepRow = load(keepId);
    const drop = load(dropId);
    if (!keepRow || !drop) {
      console.log(`! skipping [${keepId} <- ${dropId}]: no card #${keepRow ? dropId : keepId}`);
      continue;
    }
    const keep = kept.get(keepId) ?? rowToRec(keepRow);
    kept.set(keepId, keep);
    const { conflicts } = mergeStored(keep, drop, country);
    drops.push(dropId);
    const cols = recToColumns(keep);
    console.log(`\n• ${keep.full_name}  (keep #${keepId} <- drop #${dropId} ${drop.full_name})`);
    console.log(`   emails  : ${[cols.email, ...(cols.alt_emails?.split('\n') ?? [])].filter(Boolean).join(', ') || '-'}`);
    console.log(`   phones  : ${[cols.phone, ...(cols.alt_phones?.split('\n') ?? [])].filter(Boolean).join(', ') || '-'}`);
    console.log(`   company : ${cols.company ?? '-'}`);
    if (keep.photo) console.log('   photo   : taken from the dropped card');
    if (conflicts.length) console.log(`   + note  : also ${conflicts.join('; ')}`);
  }

  if (!APPLY) {
    console.log(`\n(dry run — ${drops.length} merges; re-run with --apply to write)`);
    return;
  }
  if (drops.length === 0) return;

  const backup = backupDatabase();
  const upd = db.prepare(`
    UPDATE contacts SET
      full_name = @full_name, title = @title, company = @company, email = @email, phone = @phone,
      alt_emails = @alt_emails, alt_phones = @alt_phones, urls = @urls, notes = @notes,
      connected_on = @connected_on, last_contacted = @last_contacted, industry = @industry, sources = @sources,
      updated_at = datetime('now')
    WHERE id = @id
  `);
  const photo = db.prepare('UPDATE contacts SET photo = ?, photo_type = ? WHERE id = ?');
  const del = db.prepare('DELETE FROM contacts WHERE id = ?');

  db.exec('BEGIN');
  try {
    for (const [id, rec] of kept) {
      upd.run({ id, ...recToColumns(rec) });
      if (rec.photo) photo.run(rec.photo.data, rec.photo.type, id);
    }
    for (const id of drops) del.run(id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log(`\nApplied ${drops.length} merges (deleted ${drops.length} duplicate rows).`);
  if (backup) console.log(`Backup saved first: ${backup}`);
}

main();
