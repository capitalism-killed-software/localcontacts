import type { IncomingContact, ParseResult } from '../types';
import { stripBom } from '../detect';
import { clean, cleanIndustry, dedupeEmails, dedupePhones, dedupeStrings, defaultCountry, isoDate, NO_NAME } from '../normalize';
import { photoFromBase64, photoFromDataUri, type Photo, type PhotoResult } from '../../photo';
import { isTag } from '../tags';

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
  fnPref: number;
  group: boolean; // a contact group (Apple's KIND:group card), not a person
  own: boolean; // written by localcontacts' own export
  nameless: boolean; // our export's marker for a card without a name
  categories: string[];
};

const ENCODINGS = new Set(['QUOTED-PRINTABLE', 'BASE64', 'B', '8BIT', '7BIT']);
const IGNORED = new Set(['ADR', 'BDAY', 'LOGO', 'SOUND', 'KEY', 'GEO', 'ANNIVERSARY']);
// Bookkeeping that carries nothing about the person, so it isn't reported as "not imported".
const SILENT = new Set([
  'VERSION', 'REV', 'KIND', 'X-ADDRESSBOOKSERVER-KIND', 'X-ADDRESSBOOKSERVER-MEMBER', 'MEMBER', 'X-ABLABEL',
  'X-ABUID', 'X-ABSHOWAS', 'SORT-STRING', 'CLASS', 'MAILER', 'SOURCE', 'NAME', 'PROFILE', 'AGENT',
  'X-PHONETIC-FIRST-NAME', 'X-PHONETIC-MIDDLE-NAME', 'X-PHONETIC-LAST-NAME', 'X-PHONETIC-ORG',
]);
// Text properties whose value may be base64-encoded (rare, but some exporters do it).
const TEXT_PROPS = new Set(['FN', 'N', 'NOTE', 'ORG', 'TITLE', 'EMAIL', 'TEL', 'URL'])

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

// charset null: none given; UTF-8 if the bytes are UTF-8, else Windows-1252.
function decodeQP(s: string, charset: string | null): string {
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
  const data = Uint8Array.from(bytes);
  if (charset) {
    const label = charset.toLowerCase() === 'utf8' ? 'utf-8' : charset.toLowerCase();
    try {
      return new TextDecoder(label).decode(data);
    } catch {
      // an unknown charset name: guess below
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    return new TextDecoder('windows-1252').decode(data);
  }
}

// RFC 6350 text values: \\ \; \, and \n (or \N). One pass, so an escaped
// backslash followed by "n" stays a backslash and an "n".
const unescapeText = (v: string): string =>
  v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

// Split a structured value (N, ORG) on unescaped semicolons (CATEGORIES on
// commas), then unescape each part. A scanner rather than a regex, so an escaped
// backslash before ";" still splits but an escaped ";" does not.
function splitComponents(v: string, sep = ';'): string[] {
  const parts: string[] = [];
  let cur = '';
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c === '\\' && i + 1 < v.length) {
      cur += c + v[i + 1];
      i++;
    } else if (c === sep) {
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
  if (enc === 'B' || enc === 'BASE64') {
    if (!TEXT_PROPS.has(p.name)) return null;
    return Buffer.from(p.value.replace(/\s+/g, ''), 'base64').toString('utf-8');
  }
  if (enc === 'QUOTED-PRINTABLE') return decodeQP(p.value, p.params.get('CHARSET')?.[0] ?? null);
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

const newCard = (): Card => ({ fn: null, n: null, emails: [], tels: [], org: null, title: null, notes: [], urls: [], photo: null, uid: null, connected: null, contacted: null, industry: null, fnPref: Infinity, group: false, own: false, nameless: false, categories: [] });

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
  if (card.own && card.nameless) name = null;
  if (!name && emails.length === 0 && phones.length === 0 && !card.org) return null;
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
    // Our export lists the industry and the source groups in CATEGORIES.
    sources: card.own ? card.categories.filter((c) => c !== card.industry && isTag(c)) : undefined,
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
  let lastProp: string | null = null;
  let embeddedDepth = 0; // inside a vCard 2.1 AGENT's embedded card
  let embedded = 0;
  let unclosed = 0;
  let groups = 0;
  const notKept = (name: string) => ignored.set(name, (ignored.get(name) ?? 0) + 1);
  const finish = (c: Card) => {
    if (!c.own && c.categories.length) notKept('CATEGORIES');
    if (c.group) {
      groups++;
      return;
    }
    const contact = toContact(c);
    if (contact) contacts.push(contact);
    else skipped++;
  };

  for (const line of unfold(text)) {
    const trimmed = line.trim();
    if (embeddedDepth > 0) {
      if (/^BEGIN:VCARD$/i.test(trimmed)) embeddedDepth++;
      else if (/^END:VCARD$/i.test(trimmed)) embeddedDepth--;
      continue;
    }
    if (/^BEGIN:VCARD$/i.test(trimmed)) {
      if (card && lastProp === 'AGENT') {
        // AGENT: the person's assistant, written as a whole card inside this one.
        embeddedDepth = 1;
        embedded++;
        continue;
      }
      if (card) {
        unclosed++;
        finish(card);
      }
      card = newCard();
      lastProp = null;
      continue;
    }
    if (/^END:VCARD$/i.test(trimmed)) {
      if (card) finish(card);
      card = null;
      continue;
    }
    if (!card) continue;
    const p = parseProp(line);
    if (!p) continue;
    lastProp = p.name;
    if (IGNORED.has(p.name)) {
      notKept(p.name);
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
    if (v === null) {
      if (!SILENT.has(p.name)) notKept(p.name);
      continue;
    }
    switch (p.name) {
      case 'PRODID':
        sourceHint ??= hintFromProdId(v);
        if (/^-\/\/localcontacts\/\/EN$/i.test(v.trim())) card.own = true;
        break;
      case 'KIND':
      case 'X-ADDRESSBOOKSERVER-KIND':
        if (/^group$/i.test(v.trim())) card.group = true;
        break;
      case 'CATEGORIES':
        card.categories.push(...splitComponents(v, ',').filter(Boolean));
        break;
      case 'FN': {
        // vCard 4.0 may give several names; the lowest PREF wins.
        const fn = clean(unescapeText(v));
        const rank = pref(p);
        if (fn && rank < card.fnPref) {
          card.fn = fn;
          card.fnPref = rank;
        }
        break;
      }
      case 'N':
        if (!card.n) card.n = splitComponents(v);
        break;
      case 'EMAIL':
        card.emails.push({ v: v.trim(), pref: pref(p), i: card.emails.length });
        break;
      case 'TEL':
        card.tels.push({ v: v.trim().replace(/^tel:/i, ''), pref: pref(p), i: card.tels.length });
        break;
      case 'ORG': {
        const [org, ...units] = splitComponents(v);
        if (card.org) notKept('a second ORG');
        else card.org = clean(org ?? '') ?? clean(units.find(Boolean) ?? '');
        if (org && units.some(Boolean)) notKept('ORG department');
        break;
      }
      case 'TITLE':
        if (card.title) notKept('a second TITLE');
        else card.title = clean(unescapeText(v));
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
      case 'X-LOCALCONTACTS-NONAME':
        card.nameless = /^true$/i.test(v.trim());
        break;
      case 'X-LOCALCONTACTS-INDUSTRY':
        card.industry = cleanIndustry(unescapeText(v));
        break;
      case 'URL': {
        const u = clean(v);
        if (u) card.urls.push(u);
        break;
      }
      // Apple's social profiles: keep the ones that are links.
      case 'X-SOCIALPROFILE': {
        const u = clean(v);
        if (u && /^https?:\/\//i.test(u)) card.urls.push(u);
        else notKept(p.name);
        break;
      }
      default:
        if (!SILENT.has(p.name)) notKept(p.name);
        break;
    }
  }
  if (card) {
    unclosed++;
    finish(card);
  }

  const warnings: string[] = [];
  if (skipped) warnings.push(`${skipped} empty card(s) skipped (no name, email or phone)`);
  if (unclosed) warnings.push(`${unclosed} card(s) had no END:VCARD (the file may be cut off); imported as far as they go`);
  if (embedded) warnings.push(`${embedded} card(s) embedded in another card (AGENT) skipped`);
  if (groups) warnings.push(`${groups} group card(s) skipped: groups from other apps are not imported`);
  if (ignored.size) {
    const parts = [...ignored].map(([k, n]) => `${k} ×${n}`).join(', ');
    warnings.push(`not imported: ${parts}`);
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
