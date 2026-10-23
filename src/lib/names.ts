import { NO_NAME } from './constants';

// Contacts.app shows "First Last" with the surname in bold and sorts by
// surname. We only store one name string, so the surname is the last token,
// with common suffixes (Jr, III, PhD) kept after it.

const SUFFIX = /^(jr|sr|ii|iii|iv|phd|md|esq|cpa|mba)\.?,?$/i;

export type SplitName = { first: string; last: string; suffix: string };

export function splitName(full: string): SplitName {
  const name = full.trim().replace(/\s+/g, ' ');
  if (!name || name === NO_NAME || name.includes('@')) return { first: name, last: '', suffix: '' };
  const tokens = name.split(' ');
  if (tokens.length === 1) return { first: tokens[0], last: '', suffix: '' };
  let lastIdx = tokens.length - 1;
  let suffix = '';
  if (tokens.length >= 3 && SUFFIX.test(tokens[lastIdx])) {
    suffix = tokens[lastIdx];
    lastIdx -= 1;
  }
  return { first: tokens.slice(0, lastIdx).join(' '), last: tokens[lastIdx], suffix };
}

const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export type NameSortMode = 'last' | 'first';

// Two-level key: the part that decides the section and the order, then the
// tiebreaker. Single-token names sort by that token in both modes.
export function nameSortKey(full: string, mode: NameSortMode): [string, string] {
  const { first, last } = splitName(full);
  if (!last) return [fold(first), ''];
  return mode === 'last' ? [fold(last), fold(first)] : [fold(first), fold(last)];
}

export function sectionLetter(primaryKey: string): string {
  const c = primaryKey.charAt(0);
  return /[a-z]/.test(c) ? c.toUpperCase() : '#';
}

export type NameRow<T> = SplitName & { contact: T };
export type Section<T> = { letter: string; items: NameRow<T>[] };

// Sort by name and bucket into A…Z sections with '#' last. Stable, so rows
// that tie keep the order the database returned.
export function sectionize<T extends { full_name: string }>(contacts: T[], mode: NameSortMode): Section<T>[] {
  const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
  const rows = contacts.map((contact, i) => {
    const key = nameSortKey(contact.full_name, mode);
    return { contact, key, i, ...splitName(contact.full_name) };
  });
  rows.sort((a, b) => collator.compare(a.key[0], b.key[0]) || collator.compare(a.key[1], b.key[1]) || a.i - b.i);
  const sections: Section<T>[] = [];
  const hash: NameRow<T>[] = [];
  let cur: Section<T> | null = null;
  for (const r of rows) {
    const row: NameRow<T> = { contact: r.contact, first: r.first, last: r.last, suffix: r.suffix };
    const letter = sectionLetter(r.key[0]);
    if (letter === '#') {
      hash.push(row);
      continue;
    }
    if (!cur || cur.letter !== letter) {
      cur = { letter, items: [] };
      sections.push(cur);
    }
    cur.items.push(row);
  }
  if (hash.length) sections.push({ letter: '#', items: hash });
  return sections;
}

// Type-to-select, as in Address Book: the first row whose sort key starts
// with what was typed, or failing that the first one after it, so typing
// "ma" lands at the start of the Ms even without a "Ma…". `mode` is the
// list's sort; for sorts other than by name the whole name is matched.
export function typeAheadIndex(names: string[], typed: string, mode: NameSortMode | 'other'): number | null {
  const want = fold(typed.trim());
  if (!want || names.length === 0) return null;
  const key = (n: string) => (mode === 'other' ? fold(n) : nameSortKey(n, mode).join(' '));
  let after: number | null = null;
  for (let i = 0; i < names.length; i++) {
    const k = key(names[i]);
    if (k.startsWith(want)) return i;
    if (after === null && mode !== 'other' && k > want) after = i;
  }
  return after;
}
