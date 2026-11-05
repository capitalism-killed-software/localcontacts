import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

// Line breaks are stored as \n whatever the file used (Windows \r\n, old Mac \r),
// so a note reads the same after an export and an import.
export const unixLines = (s: string): string => s.replace(/\r\n?/g, '\n');

export const clean = (v: string | null | undefined): string | null => {
  if (v === null || v === undefined) return null;
  // A NUL would cut the text short in the database.
  const t = unixLines(String(v)).replace(/\u0000/g, '').trim();
  return t.length === 0 ? null : t;
};

// Country assumed for phone numbers written without a + prefix.
export function defaultCountry(): CountryCode {
  const v = (process.env.CONTACTS_DEFAULT_COUNTRY ?? 'US').trim().toUpperCase();
  return isCountry(v) ? v : 'US';
}

/** A two-letter country code the phone library knows (US, GB, DE, ...). */
export const isCountry = (v: string): v is CountryCode => /^[A-Z]{2}$/.test(v) && isSupportedCountry(v);

export function emailKey(email: string | null | undefined): string | null {
  const t = clean(email)?.toLowerCase() ?? null;
  return t && t.includes('@') ? t : null;
}

// "+1 (202) 555-0101" -> "+12025550101", or null when the number is not even
// a possible number for the country.
export function toE164(raw: string | null | undefined, country: CountryCode): string | null {
  const t = clean(raw);
  if (!t) return null;
  const n = parsePhoneNumberFromString(t, country);
  return n && n.isPossible() ? n.number : null;
}

// Matching key for a phone: E.164 when parseable, otherwise the bare digits
// (so odd-looking numbers still match themselves across files).
export function phoneKey(raw: string | null | undefined, country: CountryCode): string | null {
  const t = clean(raw);
  if (!t) return null;
  const e = toE164(t, country);
  if (e) return e;
  const digits = t.replace(/\D/g, '');
  return digits.length >= 7 ? `raw:${digits}` : null;
}

// Loose key for name matching: lowercase, punctuation stripped, whitespace
// collapsed. Unicode-aware so non-Latin names still produce a usable key.
export const nameKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export { NO_NAME } from '../constants';

export function dedupeBy<T>(items: T[], key: (t: T) => string | null): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = key(it);
    if (k !== null) {
      if (seen.has(k)) continue;
      seen.add(k);
    }
    out.push(it);
  }
  return out;
}

const trimmed = (list: string[]) => list.map((s) => s.trim()).filter((s) => s.length > 0);

// The addresses in an email value: "mailto:" dropped, a cell holding several
// ("a@x.com, b@x.com; c@x.com") split, and anything that is not an address (an
// Exchange "/o=..." path, a phone number in the wrong column) left out.
const ADDRESS = /[^\s@<>,;:"'()[\]]+@[^\s@<>,;:"'()[\]]+\.[^\s@<>,;:"'()[\]]+/g;
export const extractEmails = (v: string): string[] => v.match(ADDRESS) ?? [];

export const dedupeEmails = (list: string[]): string[] =>
  dedupeBy(trimmed(list).flatMap(extractEmails), (e) => emailKey(e) ?? e.toLowerCase());

export const dedupePhones = (list: string[], country: CountryCode): string[] =>
  dedupeBy(trimmed(list), (p) => phoneKey(p, country) ?? p);

export const dedupeStrings = (list: string[]): string[] => dedupeBy(trimmed(list), (s) => s);

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

// "16 Sep 2025" -> "2025-09-16"; "2025-09-16T10:00:00" -> "2025-09-16";
// anything else is returned as given.
export function isoDate(v: string | null | undefined): string | null {
  const s = clean(v);
  if (!s) return null;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})$/);
  if (!m) return s;
  const mm = MONTHS[m[2].toLowerCase()];
  if (!mm) return s;
  return `${m[3]}-${mm}-${m[1].padStart(2, '0')}`;
}

// An industry named like the built-in "unclassified" group means no industry.
export const cleanIndustry = (v: string | null | undefined): string | null => {
  const t = clean(v);
  return t && !['none', 'all', 'unclassified'].includes(t.toLowerCase()) ? t : null;
};

export const splitLines = (v: string | null | undefined): string[] =>
  v ? v.split('\n').map((s) => s.trim()).filter(Boolean) : [];

export const joinLines = (list: string[]): string | null => (list.length ? list.join('\n') : null);

export const joinName = (...parts: Array<string | null | undefined>): string | null =>
  clean(parts.map((p) => clean(p)).filter(Boolean).join(' '));
