import type { IncomingContact, ParseResult } from '../types';
import { stripBom } from '../detect';
import { clean, dedupeEmails, dedupePhones, dedupeStrings, defaultCountry, isoDate, NO_NAME } from '../normalize';
import { photoFromBase64, photoFromDataUri, type Photo, type PhotoResult } from '../../photo';

// vCard 2.1, 3.0 and 4.0 as produced by Apple (iCloud, macOS, iPhone), Google,
// Proton, Android, Outlook and Thunderbird. Keeps every email, phone and URL
// and an embedded photo; ignores addresses, birthdays and photos that are only
// a link (fetching them would be a network call).

type Params = Map<string, string[]>;
type Prop = { name: string; params: Params; value: string };
type Ranked = { v: string; pref: number; i: number };
type Card = {
  fn: string | null;
  n: string[] | null;
  emails: Ranked[];
  tels: Ranked[];
  org: string | null;
  title: string | null;
  notes: string[];
  urls: string[];
  photo: Photo | null;
  uid: string | null;
  connected: string | null;
  contacted: string | null;
  industry: string | null;
};

const ENCODINGS = new Set(['QUOTED-PRINTABLE', 'BASE64', 'B', '8BIT', '7BIT']);
const IGNORED = new Set(['ADR', 'BDAY', 'LOGO', 'SOUND', 'KEY', 'GEO', 'ANNIVERSARY']);

type PhotoSkip = 'link' | 'not-image' | 'too-large' | 'empty';

// PHOTO in its three shapes: 3.0 ENCODING=b, 2.1 ENCODING=BASE64, 4.0 data: URI.
function readPhoto(p: Prop): { photo: Photo } | { skip: PhotoSkip } {
  const enc = p.params.get('ENCODING')?.[0];
  let r: PhotoResult;
  if (enc === 'B' || enc === 'BASE64') r = photoFromBase64(p.value);
  else if (/^data:/i.test(p.value.trim())) r = photoFromDataUri(p.value);
  else return { skip: 'link' };
  return 'photo' in r ? { photo: r.photo } : { skip: r.error };
}

const isQpSoftBreak = (l: string): boolean => l.endsWith('=') && /^[^:]*QUOTED-PRINTABLE[^:]*:/i.test(l);

// Join folded lines (continuations start with a space or tab) and
// quoted-printable soft line breaks (a line ending in "=").
function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of stripBom(text).split(/\r\n|\r|\n/)) {
    const last = out.length - 1;
    if (last >= 0 && (line.startsWith(' ') || line.startsWith('\t'))) {
      out[last] += line.slice(1);
    } else if (last >= 0 && isQpSoftBreak(out[last])) {
      out[last] = out[last].slice(0, -1) + line;
    } else {
      out.push(line);
    }
  }
  return out;
}

function splitOutsideQuotes(s: string, sep: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQ = false;
  for (const c of s) {
    if (c === '"') {
      inQ = !inQ;
      cur += c;
    } else if (c === sep && !inQ) {
      parts.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  parts.push(cur);
  return parts;
}

function parseProp(line: string): Prop | null {
  let inQ = false;
  let idx = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ':' && !inQ) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return null;
  const head = line.slice(0, idx);
  const value = line.slice(idx + 1);
  const [rawName, ...rawParams] = splitOutsideQuotes(head, ';');
  let name = rawName.trim().toUpperCase();
  if (name.includes('.')) name = name.slice(name.indexOf('.') + 1); // drop the "itemN." group
  const params: Params = new Map();
  const add = (k: string, vals: string[]) => {
    const cur = params.get(k) ?? [];
    cur.push(...vals);
    params.set(k, cur);
  };
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq < 0) {
      // vCard 2.1 bare parameter: TEL;CELL;PREF or N;QUOTED-PRINTABLE
      const tok = p.trim().toUpperCase();
      if (tok) add(ENCODINGS.has(tok) ? 'ENCODING' : 'TYPE', [tok]);
      continue;
    }
    const k = p.slice(0, eq).trim().toUpperCase();
    const v = p.slice(eq + 1).trim().replace(/^"|"$/g, '');
    const vals = v.split(',').map((x) => x.trim()).filter(Boolean);
    add(k, k === 'CHARSET' ? vals : vals.map((x) => x.toUpperCase()));
  }
  return { name, params, value };
}

function decodeQP(s: string, charset: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '=') {
      const hex = s.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
      }
      continue; // a lone "=" is a soft-break remnant
    }
    const code = c.charCodeAt(0);
    if (code < 128) bytes.push(code);
    else bytes.push(...Buffer.from(c, 'utf-8'));
  }
  const label = charset.toLowerCase() === 'utf8' ? 'utf-8' : charset.toLowerCase();
  try {
    return new TextDecoder(label).decode(Uint8Array.from(bytes));
  } catch {
    return new TextDecoder('utf-8').decode(Uint8Array.from(bytes));
  }
}

// RFC 6350 text values: \\ \; \, and \n (or \N). One pass, so an escaped
// backslash followed by "n" stays a backslash and an "n".
const unescapeText = (v: string): string =>
  v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

// Split a structured value (N, ORG) on unescaped semicolons, then unescape
// each part. A scanner rather than a regex, so an escaped backslash before ";" still splits but an escaped ";" does not.
function splitComponents(v: string): string[] {
  const parts: string[] = [];
  let cur = '';
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c === '\\' && i + 1 < v.length) {
      cur += c + v[i + 1];
      i++;
    } else if (c === ';') {
      parts.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  parts.push(cur);
  return parts.map((part) => unescapeText(part).trim());
}

// The property's text, or null when it is binary (base64) and not wanted.
function decodeValue(p: Prop): string | null {
  const enc = p.params.get('ENCODING')?.[0];
  if (enc === 'B' || enc === 'BASE64') return null;
  if (enc === 'QUOTED-PRINTABLE') return decodeQP(p.value, p.params.get('CHARSET')?.[0] ?? 'utf-8');
  return p.value;
}

// Lower is more preferred: vCard 4 PREF=n, else TYPE=PREF, else unranked.
function pref(p: Prop): number {
  const n = Number(p.params.get('PREF')?.[0]);
  if (Number.isFinite(n) && n > 0) return n;
  return p.params.get('TYPE')?.includes('PREF') ? 1 : 100;
}

function hintFromProdId(v: string): string | null {
  if (/apple/i.test(v)) return 'apple';
  if (/proton/i.test(v)) return 'proton';
  if (/microsoft|outlook/i.test(v)) return 'outlook';
  if (/mozilla|thunderbird/i.test(v)) return 'thunderbird';
  if (/google/i.test(v)) return 'google';
  return null;
}

const newCard = (): Card => ({ fn: null, n: null, emails: [], tels: [], org: null, title: null, notes: [], urls: [], photo: null, uid: null, connected: null, contacted: null, industry: null });

const byPref = (a: Ranked, b: Ranked) => a.pref - b.pref || a.i - b.i;

function toContact(card: Card): IncomingContact | null {
  const country = defaultCountry();
  const emails = dedupeEmails([...card.emails].sort(byPref).map((e) => e.v));
  const phones = dedupePhones([...card.tels].sort(byPref).map((t) => t.v), country);
  let name = card.fn;
  if (!name && card.n) {
    const [family, given, additional] = card.n;
    name = clean([given, additional, family].filter(Boolean).join(' '));
  }
  if (!name) name = card.org;
  if (!name && emails.length === 0 && phones.length === 0) return null;
  return {
    name: name ?? NO_NAME,
    emails,
    phones,
    org: card.org,
    title: card.title,
    notes: card.notes.length ? card.notes.join('\n') : null,
    urls: dedupeStrings(card.urls),
    connected_on: card.connected,
    last_contacted: card.contacted,
    industry: card.industry,
    uid: card.uid,
    photo: card.photo,
  };
}

export function parseVcard(text: string): ParseResult {
  const contacts: IncomingContact[] = [];
  const ignored = new Map<string, number>();
  let sourceHint: string | null = null;
  let skipped = 0;
  let photos = 0;
  const photoSkips = new Map<PhotoSkip, number>();
  let card: Card | null = null;

  for (const line of unfold(text)) {
    const trimmed = line.trim();
    if (/^BEGIN:VCARD$/i.test(trimmed)) {
      card = newCard();
      continue;
    }
    if (/^END:VCARD$/i.test(trimmed)) {
      if (card) {
        const c = toContact(card);
        if (c) contacts.push(c);
        else skipped++;
      }
      card = null;
      continue;
    }
    if (!card) continue;
    const p = parseProp(line);
    if (!p) continue;
    if (IGNORED.has(p.name)) {
      ignored.set(p.name, (ignored.get(p.name) ?? 0) + 1);
      continue;
    }
    if (p.name === 'PHOTO') {
      if (card.photo) continue;
      const r = readPhoto(p);
      if ('photo' in r) {
        card.photo = r.photo;
        photos++;
      } else photoSkips.set(r.skip, (photoSkips.get(r.skip) ?? 0) + 1);
      continue;
    }
    const v = decodeValue(p);
    if (v === null) continue;
    switch (p.name) {
      case 'PRODID':
        sourceHint ??= hintFromProdId(v);
        break;
      case 'FN':
        if (!card.fn) card.fn = clean(unescapeText(v));
        break;
      case 'N':
        if (!card.n) card.n = splitComponents(v);
        break;
      case 'EMAIL':
        card.emails.push({ v: v.trim(), pref: pref(p), i: card.emails.length });
        break;
      case 'TEL':
        card.tels.push({ v: v.trim().replace(/^tel:/i, ''), pref: pref(p), i: card.tels.length });
        break;
      case 'ORG':
        if (!card.org) card.org = clean(splitComponents(v).filter(Boolean)[0] ?? '');
        break;
      case 'TITLE':
        if (!card.title) card.title = clean(unescapeText(v));
        break;
      case 'NOTE': {
        const t = clean(unescapeText(v));
        if (t) card.notes.push(t);
        break;
      }
      case 'UID':
        if (!card.uid) card.uid = clean(v);
        break;
      // Written by localcontacts' own export, so a round trip keeps them.
      case 'X-LOCALCONTACTS-CONNECTED':
        card.connected = isoDate(v);
        break;
      case 'X-LOCALCONTACTS-LASTCONTACTED':
        card.contacted = isoDate(v);
        break;
      case 'X-LOCALCONTACTS-INDUSTRY':
        card.industry = clean(unescapeText(v));
        break;
      case 'URL': {
        const u = clean(v);
        if (u) card.urls.push(u);
        break;
      }
      default:
        break;
    }
  }

  const warnings: string[] = [];
  if (skipped) warnings.push(`${skipped} empty card(s) skipped (no name, email or phone)`);
  if (ignored.size) {
    const parts = [...ignored].map(([k, n]) => `${k} ×${n}`).join(', ');
    warnings.push(`not imported: ${parts} (addresses and birthdays are not kept)`);
  }
  if (photos) warnings.push(`${photos} photo(s) kept`);
  const why: Record<PhotoSkip, string> = {
    link: 'only a link (not fetched)',
    'not-image': 'not a JPEG, PNG, GIF or WebP image',
    'too-large': 'larger than 2 MB',
    empty: 'empty',
  };
  for (const [k, n] of photoSkips) warnings.push(`${n} photo(s) skipped: ${why[k]}`);
  return { contacts, warnings, sourceHint };
}
