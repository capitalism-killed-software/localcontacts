import type { CountryCode } from 'libphonenumber-js';
import { bulkWrite } from '../backups';
import { getDb } from '../db';
import { namesCompatible, recToColumns, rowToRec, type ExistingRow, type Rec } from '../import/merge';
import { mergeStored, type Pair, type StoredRow } from '../import/dupes';
import { defaultCountry, emailKey, nameKey, NO_NAME, phoneKey } from '../import/normalize';
import { SAMPLE_TAG } from '../sample';

// Possible duplicates in the book, for Clean-up. The rules are the importer's,
// spelled out so the sheet can say why two cards are shown together:
// - "email": they share an email address;
// - "phone": they share a phone number and their names could be the same
//   person (not "Mary Smith" and "John Smith" on one landline) without
//   disagreeing emails;
// - "name": they have the same name, whatever else differs. The importer keeps
//   such cards apart when their emails and phones both disagree; here a person
//   decides.
// Made-up sample people are only ever paired with each other, and pairs someone
// marked "Not the same person" are left out. A group of more than ten cards
// (a shared office line, a very common name) is counted, not listed.

export type DuplicateReason = 'email' | 'phone' | 'name';
export type DuplicatePair = { a: number; b: number; reason: DuplicateReason };
export type DuplicateReport = { pairs: DuplicatePair[]; largeGroups: number[] };

const MAX_GROUP = 10;
const STRENGTH: Record<DuplicateReason, number> = { email: 0, phone: 1, name: 2 };

export const pairKey = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);

const lines = (v: string | null | undefined): string[] => (v ? v.split('\n') : []);

type Card = { row: ExistingRow; emails: Set<string>; phones: Set<string>; name: string; sample: boolean };

export function findDuplicates(rows: ExistingRow[], country: CountryCode, opts: { dismissed?: Set<string> } = {}): DuplicateReport {
  const dismissed = opts.dismissed ?? new Set<string>();
  const cards = new Map<number, Card>();
  const buckets = { email: new Map<string, number[]>(), phone: new Map<string, number[]>(), name: new Map<string, number[]>() };
  const add = (map: Map<string, number[]>, key: string, id: number) => {
    const list = map.get(key);
    if (list) list.push(id);
    else map.set(key, [id]);
  };
  for (const row of rows) {
    const emails = new Set([row.email, ...lines(row.alt_emails)].map(emailKey).filter((k): k is string => !!k));
    const phones = new Set([row.phone, ...lines(row.alt_phones)].map((p) => phoneKey(p, country)).filter((k): k is string => !!k));
    const name = row.full_name === NO_NAME || row.full_name.includes('@') ? '' : nameKey(row.full_name);
    cards.set(row.id, { row, emails, phones, name, sample: row.sources === SAMPLE_TAG });
    for (const k of emails) add(buckets.email, k, row.id);
    for (const k of phones) add(buckets.phone, k, row.id);
    if (name) add(buckets.name, name, row.id);
  }

  const conflict = (x: Set<string>, y: Set<string>) => x.size > 0 && y.size > 0 && ![...x].some((k) => y.has(k));
  const found = new Map<string, DuplicatePair>();
  const large = new Map<string, number>(); // the members of a group too big to list, by their ids
  for (const reason of ['email', 'phone', 'name'] as const) {
    for (const ids of buckets[reason].values()) {
      if (ids.length < 2) continue;
      if (ids.length > MAX_GROUP) {
        large.set([...ids].sort((p, q) => p - q).join(','), ids.length);
        continue;
      }
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const x = cards.get(ids[i])!;
          const y = cards.get(ids[j])!;
          if (x.row.id === y.row.id || x.sample !== y.sample) continue;
          if (reason === 'phone' && (!namesCompatible(x.row.full_name, y.row.full_name) || conflict(x.emails, y.emails))) continue;
          const key = pairKey(x.row.id, y.row.id);
          if (dismissed.has(key)) continue;
          const had = found.get(key);
          if (!had || STRENGTH[reason] < STRENGTH[had.reason]) {
            found.set(key, { a: Math.min(x.row.id, y.row.id), b: Math.max(x.row.id, y.row.id), reason });
          }
        }
      }
    }
  }

  // Cards joined through several pairs form one group; a group over the limit is counted, not listed.
  const parent = new Map<number, number>();
  const root = (id: number): number => {
    let r = id;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(id, r);
    return r;
  };
  for (const p of found.values()) parent.set(root(p.b), root(p.a));
  const size = new Map<number, number>();
  const members = new Set<number>();
  for (const p of found.values()) members.add(p.a).add(p.b);
  for (const id of members) size.set(root(id), (size.get(root(id)) ?? 0) + 1);
  const bigRoots = new Map<number, number>();
  for (const [r, n] of size) if (n > MAX_GROUP) bigRoots.set(r, n);

  const pairs = [...found.values()]
    .filter((p) => !bigRoots.has(root(p.a)))
    .sort(
      (p, q) =>
        STRENGTH[p.reason] - STRENGTH[q.reason] ||
        nameKey(cards.get(p.a)!.row.full_name).localeCompare(nameKey(cards.get(q.a)!.row.full_name)) ||
        p.a - q.a ||
        p.b - q.b
    );
  return { pairs, largeGroups: [...large.values(), ...bigRoots.values()].sort((p, q) => q - p) };
}

const ROW_COLUMNS = `id, full_name, title, company, email, phone, alt_emails, alt_phones, urls,
  notes, connected_on, last_contacted, sources, industry, (photo_type IS NOT NULL) AS has_photo`;

/** The "Not the same person" pairs, as pairKey strings. */
export function dismissedPairs(): Set<string> {
  const rows = getDb().prepare('SELECT a, b FROM not_duplicates').all() as Array<{ a: number; b: number }>;
  return new Set(rows.map((r) => pairKey(r.a, r.b)));
}

/** Possible duplicates in the whole book. */
export function bookDuplicates(): DuplicateReport {
  const rows = getDb().prepare(`SELECT ${ROW_COLUMNS} FROM contacts`).all() as unknown as ExistingRow[];
  return findDuplicates(rows, defaultCountry(), { dismissed: dismissedPairs() });
}

/**
 * Where each dropped card goes. A card kept in one pair and dropped in another
 * goes, with everything merged into it, to the card that keeps it; a pair that
 * would close a loop, or merge a card into itself, is skipped.
 */
function resolveMerges(pairs: Pair[]): Map<number, number> {
  const into = new Map<number, number>();
  const finalKeep = (id: number): number => {
    let k = id;
    const seen = new Set<number>();
    while (into.has(k) && !seen.has(k)) {
      seen.add(k);
      k = into.get(k)!;
    }
    return k;
  };
  for (const [keep, drop] of pairs) {
    if (keep === drop || into.has(drop) || finalKeep(keep) === drop) continue;
    into.set(drop, keep);
  }
  return new Map([...into.keys()].map((drop) => [drop, finalKeep(drop)]));
}

/**
 * Clean-up's Apply for duplicates: merges each keep:drop pair the way an import
 * merges (every email, phone, link and source is kept, a photo fills an empty
 * frame, values that disagree go into the note), and remembers the pairs that
 * are not the same person. One backup first, one transaction. Cards that no
 * longer exist are skipped.
 */
export function applyDuplicates(d: { merges?: Pair[]; dismiss?: Pair[] }): { merged: number; dismissed: number; backup: string | null } {
  const db = getDb();
  const get = db.prepare(
    `SELECT id, full_name, title, company, email, phone, alt_emails, alt_phones, urls, notes,
            connected_on, last_contacted, sources, industry, photo IS NOT NULL AS has_photo, photo, photo_type
       FROM contacts WHERE id = ?`
  );
  const load = (id: number) => get.get(id) as StoredRow | undefined;
  const country = defaultCountry();

  // Work out every merge before writing anything.
  const kept = new Map<number, Rec>();
  const drops: number[] = [];
  for (const [drop, keep] of resolveMerges(d.merges ?? [])) {
    const keepRow = load(keep);
    const dropRow = load(drop);
    if (!keepRow || !dropRow) continue;
    const rec = kept.get(keep) ?? rowToRec(keepRow);
    kept.set(keep, rec);
    mergeStored(rec, dropRow, country);
    drops.push(drop);
  }
  const dismiss = (d.dismiss ?? []).filter(([a, b]) => a !== b && load(a) && load(b));
  if (drops.length === 0 && dismiss.length === 0) return { merged: 0, dismissed: 0, backup: null };

  const { backup } = bulkWrite('merge', null, (tx) => {
    const upd = tx.prepare(`
      UPDATE contacts SET
        full_name = @full_name, title = @title, company = @company, email = @email, phone = @phone,
        alt_emails = @alt_emails, alt_phones = @alt_phones, urls = @urls, notes = @notes,
        connected_on = @connected_on, last_contacted = @last_contacted, industry = @industry, sources = @sources,
        updated_at = datetime('now')
      WHERE id = @id
    `);
    const photo = tx.prepare('UPDATE contacts SET photo = ?, photo_type = ? WHERE id = ?');
    const del = tx.prepare('DELETE FROM contacts WHERE id = ?');
    const not = tx.prepare('INSERT OR IGNORE INTO not_duplicates (a, b) VALUES (?, ?)');
    for (const [id, rec] of kept) {
      upd.run({ id, ...recToColumns(rec) });
      if (rec.photo) photo.run(rec.photo.data, rec.photo.type, id);
    }
    for (const id of drops) del.run(id);
    for (const [a, b] of dismiss) not.run(Math.min(a, b), Math.max(a, b));
  });
  return { merged: drops.length, dismissed: dismiss.length, backup };
}
