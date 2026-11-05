import { NO_NAME } from './constants';

// Tidying names that are really email addresses or address wrappers (a side
// effect of Google and iCloud exports), used by `npm run clean:names`. A name is
// only changed when something strictly better can be made, and nothing is lost:
// an address that appears only in the name is added to the card's emails, and a
// company cut from "Name @ Company" fills an empty company field.

export type NameRow = { full_name: string; email: string | null; alt_emails: string | null; company: string | null };
export type NameFix = { name: string; addEmails: string[]; company: string | null };

// Role and shared mailboxes that should not become a person's name.
const ROLE = new Set([
  'sales', 'support', 'info', 'admin', 'customercare', 'upgrade', 'apply',
  'hello', 'contact', 'contactus', 'team', 'noreply', 'no-reply', 'office',
  'mail', 'billing', 'help', 'careers', 'jobs', 'newsletter',
]);

const EMAIL_IN_TEXT = /[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[^\s@<>()"',;]+/g;
export const emailLike = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

// "first.last@x" / "first_last@x" -> "First Last"; null when it isn't a
// confident person name (single token, digits, role mailbox, initials).
export function deriveFromEmail(email: string | null): string | null {
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

/** A better name for the card, or null to leave it alone. */
export function proposeNameFix(row: NameRow): NameFix | null {
  const name = row.full_name;
  const stored = [row.email, ...(row.alt_emails ?? '').split('\n')].map((e) => (e ?? '').trim()).filter(Boolean);
  const known = new Set(stored.map(lower));
  const inName = [...new Set(name.match(EMAIL_IN_TEXT) ?? [])];
  const addEmails = inName.filter((e) => !known.has(lower(e)));
  let company: string | null = null;

  let pre = name;
  // "Frank Fish" <frank@example.com>  or  Frank Fish <frank@example.com>
  const angle = pre.match(/^\s*"?([^"<>]*?)"?\s*<[^<>]*>\s*$/);
  if (angle) pre = angle[1];
  // Remove balanced "(...)" groups but keep the text around them, so
  // "Ada (@countess) Lovelace" -> "Ada Lovelace" (not just "Ada").
  pre = pre.replace(/\([^)]*\)/g, ' ');
  // An unclosed "(" (a truncated email): drop from it onward.
  const openParen = pre.indexOf('(');
  if (openParen >= 0) pre = pre.slice(0, openParen);
  // "Name @ Company": the company moves to an empty company field, or matches it.
  const at = pre.indexOf(' @ ');
  if (at >= 0) {
    const suffix = pre.slice(at + 3).trim();
    if (!row.company) company = suffix || null;
    else if (lower(suffix) !== lower(row.company)) return null;
    pre = pre.slice(0, at);
  }
  pre = pre.trim().replace(/^['"]+|['"]+$/g, '').trim();
  // Collapse an exact "X X" duplication ("a@b a@b" -> "a@b").
  const dup = pre.match(/^(.+?)\s+\1$/);
  if (dup) pre = dup[1];
  pre = pre.replace(/\s+/g, ' ').trim();

  let proposed: string | null;
  if (name === NO_NAME || pre === '') {
    proposed = deriveFromEmail(stored[0] ?? inName[0] ?? null) ?? stored[0] ?? inName[0] ?? null;
  } else if (emailLike(pre)) {
    // The name is an address: a person's name from that address, or the bare address.
    proposed = deriveFromEmail(pre) ?? pre;
  } else {
    proposed = pre; // a real name survived after stripping the wrapper
  }

  if (!proposed || proposed === name) return null;
  return { name: proposed, addEmails, company };
}
