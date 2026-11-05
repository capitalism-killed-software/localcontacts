import { bulkWrite } from '../backups';
import { emailLike, proposeNameFix, type NameRow } from '../clean-names';
import { getDb } from '../db';

// Tidying names that are an email address or junk (a side effect of Google and
// iCloud exports). The rules are in ../clean-names.ts; a name is only changed
// when something strictly better comes out, and an address that appears only
// in the name is kept as one of the card's emails.

export type NameCandidate = {
  id: number;
  from: string;
  to: string;
  addEmails: string[]; // addresses found only in the name, kept as emails
  company: string | null; // a company taken from "Name @ Company", for a card without one
  derived: boolean; // a real name came out (rather than just the bare address)
};

type Row = NameRow & { id: number };

const loadRows = (): Row[] =>
  getDb()
    .prepare(
      `SELECT id, full_name, email, alt_emails, company FROM contacts
       WHERE full_name LIKE '%@%' OR full_name = '(no name)'
       ORDER BY full_name, id`
    )
    .all() as Row[];

/** Every card whose name can be tidied, with the name it would get. */
export function nameFixCandidates(): NameCandidate[] {
  return loadRows().flatMap((row) => {
    const fix = proposeNameFix(row);
    return fix ? [{ id: row.id, from: row.full_name, to: fix.name, addEmails: fix.addEmails, company: fix.company, derived: !emailLike(fix.name) }] : [];
  });
}

/** How many cards are looked at (names that are an address, or no name). */
export const nameCandidateCount = (): number => loadRows().length;

/**
 * Tidies the given cards' names, after a backup. The fixes are worked out again
 * here, so a card edited in the meantime gets the fix that fits it now, or none.
 */
export function applyNameFixes(ids: number[]): { changed: number; backup: string | null } {
  const wanted = new Set(ids);
  const todo = loadRows().flatMap((row) => {
    if (!wanted.has(row.id)) return [];
    const fix = proposeNameFix(row);
    return fix ? [{ row, fix }] : [];
  });
  if (todo.length === 0) return { changed: 0, backup: null };
  const { result, backup } = bulkWrite('names', null, (db) => {
    const upd = db.prepare(
      `UPDATE contacts SET full_name = ?, email = ?, alt_emails = ?, company = ?, updated_at = datetime('now') WHERE id = ?`
    );
    for (const { row, fix } of todo) {
      const emails = [row.email, ...(row.alt_emails ?? '').split('\n'), ...fix.addEmails].map((e) => (e ?? '').trim()).filter(Boolean);
      upd.run(fix.name, emails[0] ?? null, emails.slice(1).join('\n') || null, row.company ?? fix.company, row.id);
    }
    return todo.length;
  });
  return { changed: result, backup };
}
