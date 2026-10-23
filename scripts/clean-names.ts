/**
 * Tidy contacts whose display name is an email address or junk (a side effect of
 * Google/iCloud exports). Strategy, in order of preference:
 *   1. Strip a "Real Name (email@x.com)" wrapper -> "Real Name".
 *   2. Strip a "Name @ Company" suffix -> "Name".
 *   3. Derive "First Last" from a first.last@ / first_last@ email local part.
 *   4. Otherwise fall back to the bare email address (cleaner than the wrapper).
 *
 * A name is only changed when we can produce something strictly better, and the
 * email/phone/company fields are never touched.
 *
 * Usage:
 *   npm run clean:names            # dry run — prints proposed changes only
 *   npm run clean:names -- --apply # write the changes
 */
import { getDb } from '../src/lib/db';

const APPLY = process.argv.includes('--apply');

// Role / shared mailboxes that should NOT become a person's name.
const ROLE = new Set([
  'sales', 'support', 'info', 'admin', 'customercare', 'upgrade', 'apply',
  'hello', 'contact', 'contactus', 'team', 'noreply', 'no-reply', 'office',
  'mail', 'billing', 'help', 'careers', 'jobs', 'newsletter',
]);

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const emailLike = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// "first.last@x" / "first_last@x" -> "First Last"; null when it isn't a
// confident person name (single token, digits, role mailbox, initials).
function deriveFromEmail(email: string | null): string | null {
  if (!email) return null;
  const local = email.split('@')[0].toLowerCase();
  if (ROLE.has(local)) return null;
  if (/\d/.test(local)) return null;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => /^[a-z]+$/.test(p) && p.length >= 2)) {
    return parts.map(cap).join(' ');
  }
  return null;
}

// Returns a better name, or null to leave the row alone.
function proposeName(name: string, email: string | null): string | null {
  const isNoName = name === '(no name)';

  let pre = name;
  // Remove balanced "(...)" groups but keep the text around them, so
  // "Ada (@countess) Lovelace" -> "Ada Lovelace" (not just "Ada").
  pre = pre.replace(/\([^)]*\)/g, ' ');
  // An unclosed "(" (a truncated email) — drop from it onward.
  const openParen = pre.indexOf('(');
  if (openParen >= 0) pre = pre.slice(0, openParen);
  // A "Name @ Company" suffix with no parens — keep the part before " @ ".
  const at = pre.indexOf(' @ ');
  if (at >= 0) pre = pre.slice(0, at);
  pre = pre.trim().replace(/^['"]+|['"]+$/g, '').trim();
  // Collapse an exact "X X" duplication ("a@b a@b" -> "a@b").
  const dup = pre.match(/^(.+?)\s+\1$/);
  if (dup) pre = dup[1];
  pre = pre.replace(/\s+/g, ' ').trim();

  let proposed: string | null;
  if (isNoName || pre === '' || emailLike(pre)) {
    proposed = deriveFromEmail(email) ?? email ?? (emailLike(pre) ? pre : null);
  } else {
    proposed = pre; // a real name survived after stripping the wrapper
  }

  if (!proposed || proposed === name) return null;
  return proposed;
}

function main() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, full_name, email FROM contacts
       WHERE full_name LIKE '%@%' OR full_name = '(no name)'
       ORDER BY full_name`
    )
    .all() as Array<{ id: number; full_name: string; email: string | null }>;

  const changes: Array<{ id: number; from: string; to: string; derived: boolean }> = [];
  for (const r of rows) {
    const to = proposeName(r.full_name, r.email);
    if (to) {
      changes.push({ id: r.id, from: r.full_name, to, derived: !emailLike(to) });
    }
  }

  console.log(`Candidates (email/junk names): ${rows.length}`);
  console.log(`Proposed changes             : ${changes.length}`);
  console.log(`  → real name derived        : ${changes.filter((c) => c.derived).length}`);
  console.log(`  → cleaned to bare email    : ${changes.filter((c) => !c.derived).length}`);
  console.log(`Unchanged (already clean-ish): ${rows.length - changes.length}`);
  console.log('');
  for (const c of changes) {
    const tag = c.derived ? 'NAME ' : 'email';
    console.log(`  [${tag}] "${c.from}"  ->  "${c.to}"`);
  }

  if (!APPLY) {
    console.log('\n(dry run — re-run with --apply to write these changes)');
    return;
  }

  const upd = db.prepare(`UPDATE contacts SET full_name = ?, updated_at = datetime('now') WHERE id = ?`);
  db.exec('BEGIN');
  try {
    for (const c of changes) upd.run(c.to, c.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log(`\nApplied ${changes.length} updates.`);
}

main();
