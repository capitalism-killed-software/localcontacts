/**
 * Merge explicit duplicate contact rows (keep <- drop). Gaps on the kept row are
 * filled from the dropped row; any conflicting value that can't fit a
 * single-value field (a second email, alternate company, etc.) is appended to
 * the kept row's Notes so nothing is lost. The dropped row is then deleted.
 *
 * Pairs are given explicitly by id, with no fuzzy name matching, because deciding
 * "same person" needs human judgment: two different people can share a name.
 *
 * Usage:
 *   npm run merge:dupes -- 12:34 56:78            # dry run
 *   npm run merge:dupes -- --apply 12:34 56:78    # write
 *
 * Each argument is keepId:dropId. Keep the row with the better primary email.
 */
import { getDb } from '../src/lib/db';

const APPLY = process.argv.includes('--apply');

function parsePairs(args: string[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (const a of args) {
    const m = a.match(/^(\d+):(\d+)$/);
    if (!m) {
      console.error(`Bad argument "${a}": expected keepId:dropId`);
      process.exit(1);
    }
    const keep = Number(m[1]);
    const drop = Number(m[2]);
    if (keep === drop) {
      console.error(`Refusing to merge ${keep} into itself`);
      process.exit(1);
    }
    pairs.push([keep, drop]);
  }
  if (pairs.length === 0) {
    console.error('Usage: npm run merge:dupes -- [--apply] keepId:dropId [keepId:dropId ...]');
    process.exit(1);
  }
  return pairs;
}

const PAIRS = parsePairs(process.argv.slice(2).filter((a) => !a.startsWith('--')));

type Row = {
  id: number;
  full_name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  connected_on: string | null;
  last_contacted: string | null;
};

const norm = (v: string | null): string => (v ?? '').trim().toLowerCase();
const FILLABLE: (keyof Row)[] = ['title', 'company', 'email', 'phone', 'connected_on', 'last_contacted'];

function main() {
  const db = getDb();
  const get = (id: number) =>
    db
      .prepare(
        'SELECT id, full_name, title, company, email, phone, notes, connected_on, last_contacted FROM contacts WHERE id = ?'
      )
      .get(id) as Row | undefined;

  const ops: Array<{ keep: Row; extras: string[]; notes: string | null }> = [];

  for (const [keepId, dropId] of PAIRS) {
    const keep = get(keepId);
    const drop = get(dropId);
    if (!keep || !drop) {
      console.log(`! skipping [${keepId} <- ${dropId}] — row missing`);
      continue;
    }

    const merged: Row = { ...keep };
    const extras: string[] = [];
    // FILLABLE excludes `id`, so every value here is string | null.
    const m = merged as unknown as Record<string, string | null>;
    const d = drop as unknown as Record<string, string | null>;
    for (const f of FILLABLE) {
      if (!m[f] && d[f]) {
        m[f] = d[f];
      } else if (m[f] && d[f] && norm(m[f]) !== norm(d[f])) {
        extras.push(`${f}: ${d[f]}`);
      }
    }

    let notes = merged.notes ?? '';
    if (drop.notes && !notes.includes(drop.notes)) notes = notes ? `${notes}\n${drop.notes}` : drop.notes;
    if (extras.length) notes = `${notes ? notes + '\n' : ''}Merged duplicate — also: ${extras.join('; ')}`;
    merged.notes = notes || null;

    ops.push({ keep: merged, extras, notes: merged.notes });

    console.log(`\n• ${keep.full_name}  (keep #${keepId} <- drop #${dropId})`);
    console.log(`   email   : ${merged.email ?? '-'}`);
    console.log(`   company : ${merged.company ?? '-'}`);
    console.log(`   phone   : ${merged.phone ?? '-'}`);
    if (extras.length) console.log(`   + Notes : also ${extras.join('; ')}`);
  }

  if (!APPLY) {
    console.log(`\n(dry run — ${ops.length} merges; re-run with --apply to write)`);
    return;
  }

  const upd = db.prepare(`
    UPDATE contacts SET
      title=@title, company=@company, email=@email, phone=@phone,
      notes=@notes, connected_on=@connected_on, last_contacted=@last_contacted,
      updated_at=datetime('now')
    WHERE id=@id
  `);
  const del = db.prepare('DELETE FROM contacts WHERE id = ?');

  db.exec('BEGIN');
  try {
    for (let i = 0; i < ops.length; i++) {
      const { keep } = ops[i];
      upd.run({
        id: keep.id,
        title: keep.title,
        company: keep.company,
        email: keep.email,
        phone: keep.phone,
        notes: keep.notes,
        connected_on: keep.connected_on,
        last_contacted: keep.last_contacted,
      });
      del.run(PAIRS[i][1]);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log(`\nApplied ${ops.length} merges (deleted ${ops.length} duplicate rows).`);
}

main();
