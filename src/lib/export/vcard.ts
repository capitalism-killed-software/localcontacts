import type { Contact } from '../contacts';
import { NO_NAME } from '../constants';
import { splitName } from '../names';
import { PHOTO_EXT, type Photo } from '../photo';

// vCard 3.0 (RFC 2426) with RFC 6350 text escaping. Apple Contacts, Google
// Contacts, Outlook, Proton, Android and Thunderbird all read it. CATEGORIES
// and the X-LOCALCONTACTS-* lines carry industry, sources and dates; other
// apps ignore what they don't understand.

const CRLF = '\r\n';

const lines = (v: string | null | undefined): string[] =>
  v ? v.split('\n').map((s) => s.trim()).filter(Boolean) : [];

// Text values: backslash, newline, comma and semicolon are escaped.
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

// Values that are not free text (emails, phones, URLs): only line breaks
// would break the format, so they are removed.
const raw = (s: string): string => s.replace(/[\r\n]+/g, ' ').trim();

// Fold to 75 octets per physical line (continuations start with a space and
// carry 74), never splitting a UTF-8 sequence or a surrogate pair.
export function foldLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, 'utf8');
    if (curBytes + b > limit) {
      out.push(cur);
      cur = '';
      curBytes = 0;
      limit = 74;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join(CRLF + ' ');
}

// SQLite datetime('now') is "YYYY-MM-DD HH:MM:SS" in UTC.
function rev(updatedAt: string): string | null {
  const m = updatedAt.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]}T${m[2]}Z` : null;
}

function displayName(c: Contact): string {
  if (c.full_name && c.full_name !== NO_NAME) return c.full_name;
  return c.company || c.email || c.phone || NO_NAME;
}

export function contactToVcard(c: Contact, photo: Photo | null = null): string {
  const out: string[] = ['BEGIN:VCARD', 'VERSION:3.0', 'PRODID:-//localcontacts//EN', `UID:localcontacts-${c.id}`];
  const real = c.full_name && c.full_name !== NO_NAME && !c.full_name.includes('@');
  const { first, last, suffix } = real ? splitName(c.full_name) : { first: '', last: '', suffix: '' };
  out.push(`N:${[last, first, '', '', suffix].map(escapeText).join(';')}`);
  out.push(`FN:${escapeText(displayName(c))}`);
  if (c.company) out.push(`ORG:${escapeText(c.company)}`);
  if (c.title) out.push(`TITLE:${escapeText(c.title)}`);

  const emails = [c.email, ...lines(c.alt_emails)].filter((x): x is string => !!x);
  emails.forEach((e, i) => out.push(`EMAIL;TYPE=INTERNET${i === 0 ? ';TYPE=PREF' : ''}:${raw(e)}`));
  const phones = [c.phone, ...lines(c.alt_phones)].filter((x): x is string => !!x);
  phones.forEach((p, i) => out.push(`TEL${i === 0 ? ';TYPE=PREF' : ''}:${raw(p)}`));
  for (const u of lines(c.urls)) out.push(`URL:${raw(u)}`);
  if (c.notes) out.push(`NOTE:${escapeText(c.notes)}`);
  if (photo) out.push(`PHOTO;ENCODING=b;TYPE=${PHOTO_EXT[photo.type]}:${photo.data.toString('base64')}`);

  const categories = [c.industry, ...(c.sources ? c.sources.split(',') : [])]
    .map((x) => (x ?? '').trim())
    .filter(Boolean);
  if (categories.length) out.push(`CATEGORIES:${categories.map(escapeText).join(',')}`);
  if (c.industry) out.push(`X-LOCALCONTACTS-INDUSTRY:${escapeText(c.industry)}`);
  if (c.connected_on) out.push(`X-LOCALCONTACTS-CONNECTED:${raw(c.connected_on)}`);
  if (c.last_contacted) out.push(`X-LOCALCONTACTS-LASTCONTACTED:${raw(c.last_contacted)}`);
  const r = rev(c.updated_at);
  if (r) out.push(`REV:${r}`);
  out.push('END:VCARD');
  return out.map(foldLine).join(CRLF) + CRLF;
}

export function contactsToVcf(list: Contact[], photoOf: (c: Contact) => Photo | null = () => null): string {
  return list.map((c) => contactToVcard(c, photoOf(c))).join('');
}
