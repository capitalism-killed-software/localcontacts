import type { CountryCode } from 'libphonenumber-js';
import type { IncomingContact } from './types';
import type { Photo } from '../photo';
import { dedupeEmails, dedupePhones, dedupeStrings, emailKey, joinLines, nameKey, NO_NAME, phoneKey, splitLines } from './normalize';

// The merge engine. Every existing row and every incoming contact becomes a
// Rec; incoming ones are matched against the index by any email, then any
// phone, then normalized name (unless the two disagree on both emails and
// phones). A match fills gaps and unions the lists; no match becomes an insert.

export type ExistingRow = {
  id: number;
  full_name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  alt_emails: string | null;
  alt_phones: string | null;
  urls: string | null;
  notes: string | null;
  connected_on: string | null;
  last_contacted: string | null;
  sources: string | null;
  industry?: string | null;
  has_photo?: number | null; // 1 when a photo is stored (the bytes are not loaded)
};

export type Rec = {
  id: number | null; // null = not in the DB yet
  full_name: string;
  title: string | null;
  company: string | null;
  emails: string[];
  phones: string[];
  urls: string[];
  notes: string | null;
  connected_on: string | null;
  last_contacted: string | null;
  industry: string | null;
  sources: string[];
  batch: number | null; // which file it came from; null for rows already stored
  uid: string | null; // the card's id in that file, when it has one
  hasPhoto: boolean;
  photo: Photo | null; // a photo to write; null leaves the stored one alone
  dirty: boolean; // existing row that changed and needs an UPDATE
};

export type Batch = { source: string; contacts: IncomingContact[] };

export type MergeStats = {
  incoming: number;
  inserted: number;
  mergedIntoExisting: number;
  mergedWithinImport: number;
  filledEmail: number;
  filledPhone: number;
  addedEmails: number;
  addedPhones: number;
  addedPhotos: number;
  skippedUnmatched: number;
};

export function rowToRec(r: ExistingRow): Rec {
  return {
    id: r.id,
    full_name: r.full_name,
    title: r.title,
    company: r.company,
    emails: [r.email, ...splitLines(r.alt_emails)].filter((x): x is string => !!x),
    phones: [r.phone, ...splitLines(r.alt_phones)].filter((x): x is string => !!x),
    urls: splitLines(r.urls),
    notes: r.notes,
    connected_on: r.connected_on,
    last_contacted: r.last_contacted,
    industry: r.industry ?? null,
    sources: r.sources ? r.sources.split(',').map((s) => s.trim()).filter(Boolean) : [],
    batch: null,
    uid: null,
    hasPhoto: !!r.has_photo,
    photo: null,
    dirty: false,
  };
}

// The column values to write for a Rec: first email/phone are the primary
// ones, the rest go to the alt_* columns.
export function recToColumns(rec: Rec) {
  return {
    full_name: rec.full_name,
    title: rec.title,
    company: rec.company,
    email: rec.emails[0] ?? null,
    phone: rec.phones[0] ?? null,
    alt_emails: joinLines(rec.emails.slice(1)),
    alt_phones: joinLines(rec.phones.slice(1)),
    urls: joinLines(rec.urls),
    notes: rec.notes,
    connected_on: rec.connected_on,
    last_contacted: rec.last_contacted,
    industry: rec.industry,
    sources: rec.sources.length ? [...new Set(rec.sources)].sort().join(',') : null,
  };
}

function fromIncoming(c: IncomingContact, source: string, batch: number): Rec {
  return {
    id: null,
    full_name: c.name,
    title: c.title,
    company: c.org,
    emails: c.emails,
    phones: c.phones,
    urls: c.urls,
    notes: c.notes,
    connected_on: c.connected_on,
    last_contacted: c.last_contacted ?? null,
    industry: c.industry ?? null,
    sources: [source],
    batch,
    uid: c.uid ?? null,
    hasPhoto: !!c.photo,
    photo: c.photo ?? null,
    dirty: false,
  };
}

const isPlaceholderName = (n: string) => n === NO_NAME || n.includes('@');

// Whether two names could be the same person, for a match on a shared phone
// number: "Ada L" and "Ada Lovelace" could, "Mary Smith" and "John Smith" on
// one landline could not. An unnamed card matches anyone.
export function namesCompatible(a: string, b: string): boolean {
  if (isPlaceholderName(a) || isPlaceholderName(b)) return true;
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (!ka || !kb || ka === kb) return true;
  const fa = ka.split(' ');
  const fb = kb.split(' ');
  if (fa[0] === fb[0]) return true;
  const contains = (x: string[], y: string[]) => y.every((t) => x.includes(t));
  return contains(fa, fb) || contains(fb, fa);
}

function unionSources(t: Rec, inc: Rec): boolean {
  const before = t.sources.length;
  t.sources = [...new Set([...t.sources, ...inc.sources])];
  return t.sources.length !== before;
}

// Adds a line to the notes unless the notes already hold it.
function appendNote(t: Rec, text: string): boolean {
  if (!t.notes) {
    t.notes = text;
    return true;
  }
  if (t.notes.includes(text)) return false;
  t.notes = `${t.notes}\n${text}`;
  return true;
}

const differs = (a: string | null, b: string | null): boolean =>
  !!a && !!b && a.trim().toLowerCase() !== b.trim().toLowerCase();

// byName: the match was on the name alone, so a different title or company may
// belong to someone else or to an older job; it goes into the note rather than
// being dropped.
function mergeInto(t: Rec, inc: Rec, stats: MergeStats, country: CountryCode, byName = false): boolean {
  let changed = false;
  if (byName) {
    const also = [differs(t.title, inc.title) ? inc.title : null, differs(t.company, inc.company) ? inc.company : null]
      .filter((x): x is string => !!x);
    if (also.length && appendNote(t, `Also: ${also.join(' · ')}`)) changed = true;
  }
  for (const f of ['title', 'company', 'connected_on', 'last_contacted', 'industry'] as const) {
    if (t[f] == null && inc[f] != null) {
      t[f] = inc[f];
      changed = true;
    }
  }

  const hadEmail = t.emails.length > 0;
  const emailsBefore = t.emails.length;
  t.emails = dedupeEmails([...t.emails, ...inc.emails]);
  if (t.emails.length > emailsBefore) {
    changed = true;
    stats.addedEmails += t.emails.length - emailsBefore;
    if (!hadEmail) stats.filledEmail++;
  }

  const hadPhone = t.phones.length > 0;
  const phonesBefore = t.phones.length;
  t.phones = dedupePhones([...t.phones, ...inc.phones], country);
  if (t.phones.length > phonesBefore) {
    changed = true;
    stats.addedPhones += t.phones.length - phonesBefore;
    if (!hadPhone) stats.filledPhone++;
  }

  const urlsBefore = t.urls.length;
  t.urls = dedupeStrings([...t.urls, ...inc.urls]);
  if (t.urls.length !== urlsBefore) changed = true;

  if (inc.notes && inc.notes !== t.notes && appendNote(t, inc.notes)) changed = true;

  // A real name beats a placeholder ("(no name)" or an email address).
  if (isPlaceholderName(t.full_name) && !isPlaceholderName(inc.full_name)) {
    t.full_name = inc.full_name;
    changed = true;
  }

  // A photo fills an empty frame; a stored photo is never replaced.
  if (!t.hasPhoto && inc.photo) {
    t.photo = inc.photo;
    t.hasPhoto = true;
    stats.addedPhotos++;
    changed = true;
  }

  if (unionSources(t, inc)) changed = true;
  return changed;
}

export function planMerge(
  existing: ExistingRow[],
  batches: Batch[],
  opts: { tagOnly?: boolean; country: CountryCode }
): { rows: Rec[]; stats: MergeStats } {
  const { country } = opts;
  const tagOnly = opts.tagOnly ?? false;
  const stats: MergeStats = {
    incoming: 0, inserted: 0, mergedIntoExisting: 0, mergedWithinImport: 0,
    filledEmail: 0, filledPhone: 0, addedEmails: 0, addedPhones: 0, addedPhotos: 0, skippedUnmatched: 0,
  };
  const byEmail = new Map<string, Rec>();
  const byPhone = new Map<string, Rec>();
  const byName = new Map<string, Rec>();
  const all: Rec[] = [];

  const nameOf = (r: Rec): string => (r.full_name === NO_NAME ? '' : nameKey(r.full_name));

  const index = (r: Rec) => {
    for (const e of r.emails) {
      const k = emailKey(e);
      if (k && !byEmail.has(k)) byEmail.set(k, r);
    }
    for (const p of r.phones) {
      const k = phoneKey(p, country);
      if (k && !byPhone.has(k)) byPhone.set(k, r);
    }
    const nk = nameOf(r);
    if (nk && !byName.has(nk)) byName.set(nk, r);
  };

  // Two records whose emails are all different are different people, even
  // when they share a phone number (an office line, a family landline).
  const emailsConflict = (a: Rec, b: Rec): boolean => {
    if (a.emails.length === 0 || b.emails.length === 0) return false;
    const keys = new Set(b.emails.map(emailKey).filter(Boolean));
    return !a.emails.some((e) => keys.has(emailKey(e)));
  };

  // Same for phones: both have numbers and none of them is shared.
  const phonesConflict = (a: Rec, b: Rec): boolean => {
    if (a.phones.length === 0 || b.phones.length === 0) return false;
    const keys = new Set(b.phones.map((p) => phoneKey(p, country)).filter(Boolean));
    return !a.phones.some((p) => keys.has(phoneKey(p, country)));
  };

  // Two cards from the same file with different ids are two people as far
  // as that file is concerned; only an email match overrules that.
  const sameFileDifferentCard = (a: Rec, b: Rec): boolean =>
    a.batch !== null && a.batch === b.batch && !!a.uid && !!b.uid && a.uid !== b.uid;

  const find = (r: Rec): { hit: Rec; byName: boolean } | undefined => {
    for (const e of r.emails) {
      const k = emailKey(e);
      const hit = k ? byEmail.get(k) : undefined;
      if (hit) return { hit, byName: false };
    }
    for (const p of r.phones) {
      const k = phoneKey(p, country);
      const hit = k ? byPhone.get(k) : undefined;
      if (hit && !emailsConflict(r, hit) && namesCompatible(r.full_name, hit.full_name) && !sameFileDifferentCard(r, hit)) {
        return { hit, byName: false };
      }
    }
    // A name alone is the weakest sign: two cards that disagree on both their
    // emails and their phones are two people who share a name.
    const nk = nameOf(r);
    const hit = nk ? byName.get(nk) : undefined;
    if (!hit || sameFileDifferentCard(r, hit) || (emailsConflict(r, hit) && phonesConflict(r, hit))) return undefined;
    return { hit, byName: true };
  };

  for (const row of existing) {
    const r = rowToRec(row);
    all.push(r);
    index(r);
  }

  for (const [b, batch] of batches.entries()) {
    for (const c of batch.contacts) {
      stats.incoming++;
      const inc = fromIncoming(c, batch.source, b);
      const found = find(inc);
      if (found) {
        const target = found.hit;
        const changed = tagOnly ? unionSources(target, inc) : mergeInto(target, inc, stats, country, found.byName);
        if (changed) {
          if (target.id !== null) {
            target.dirty = true;
            stats.mergedIntoExisting++;
          } else {
            stats.mergedWithinImport++;
          }
          index(target); // it may have gained keys
        }
      } else if (tagOnly) {
        stats.skippedUnmatched++;
      } else {
        all.push(inc);
        index(inc);
        stats.inserted++;
        if (inc.photo) stats.addedPhotos++;
      }
    }
  }

  return { rows: all, stats };
}
