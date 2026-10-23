import type { CountryCode } from 'libphonenumber-js';
import type { IncomingContact } from './types';
import { dedupeEmails, dedupePhones, dedupeStrings, emailKey, joinLines, nameKey, NO_NAME, phoneKey, splitLines } from './normalize';

// The merge engine. Every existing row and every incoming contact becomes a
// Rec; incoming ones are matched against the index by any email, then any
// phone, then normalized name. A match fills gaps and unions the lists; no
// match becomes an insert.

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
  sources: string[];
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
    sources: r.sources ? r.sources.split(',').map((s) => s.trim()).filter(Boolean) : [],
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
    sources: rec.sources.length ? [...new Set(rec.sources)].sort().join(',') : null,
  };
}

function fromIncoming(c: IncomingContact, source: string): Rec {
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
    last_contacted: null,
    sources: [source],
    dirty: false,
  };
}

const isPlaceholderName = (n: string) => n === NO_NAME || n.includes('@');

function unionSources(t: Rec, inc: Rec): boolean {
  const before = t.sources.length;
  t.sources = [...new Set([...t.sources, ...inc.sources])];
  return t.sources.length !== before;
}

function mergeInto(t: Rec, inc: Rec, stats: MergeStats, country: CountryCode): boolean {
  let changed = false;
  for (const f of ['title', 'company', 'connected_on', 'last_contacted'] as const) {
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

  if (inc.notes && inc.notes !== t.notes) {
    if (!t.notes) {
      t.notes = inc.notes;
      changed = true;
    } else if (!t.notes.includes(inc.notes)) {
      t.notes = `${t.notes}\n${inc.notes}`;
      changed = true;
    }
  }

  // A real name beats a placeholder ("(no name)" or an email address).
  if (isPlaceholderName(t.full_name) && !isPlaceholderName(inc.full_name)) {
    t.full_name = inc.full_name;
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
    filledEmail: 0, filledPhone: 0, addedEmails: 0, addedPhones: 0, skippedUnmatched: 0,
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

  const find = (r: Rec): Rec | undefined => {
    for (const e of r.emails) {
      const k = emailKey(e);
      const hit = k ? byEmail.get(k) : undefined;
      if (hit) return hit;
    }
    for (const p of r.phones) {
      const k = phoneKey(p, country);
      const hit = k ? byPhone.get(k) : undefined;
      if (hit && !emailsConflict(r, hit)) return hit;
    }
    const nk = nameOf(r);
    return nk ? byName.get(nk) : undefined;
  };

  for (const row of existing) {
    const r = rowToRec(row);
    all.push(r);
    index(r);
  }

  for (const batch of batches) {
    for (const c of batch.contacts) {
      stats.incoming++;
      const inc = fromIncoming(c, batch.source);
      const target = find(inc);
      if (target) {
        const changed = tagOnly ? unionSources(target, inc) : mergeInto(target, inc, stats, country);
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
      }
    }
  }

  return { rows: all, stats };
}
