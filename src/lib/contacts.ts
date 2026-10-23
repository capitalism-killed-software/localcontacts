import { getDb } from './db';

export type Contact = {
  id: number;
  full_name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  alt_emails: string | null; // newline-separated further emails
  alt_phones: string | null; // newline-separated further phones
  urls: string | null; // newline-separated links
  notes: string | null;
  connected_on: string | null;
  last_contacted: string | null;
  sources: string | null;
  industry: string | null;
  created_at: string;
  updated_at: string;
};

// What the forms edit. The three newline-separated lists are written only
// when the key is present: an absent key leaves the stored value alone, null
// clears it. `sources` is import-managed and never touched here.
export type ContactInput = {
  full_name: string;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  alt_emails?: string | null;
  alt_phones?: string | null;
  urls?: string | null;
  notes?: string | null;
  connected_on?: string | null;
  last_contacted?: string | null;
  industry?: string | null;
};

const nullIfBlank = (v: string | null | undefined): string | null => {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
};

// A newline-separated list: trimmed, blanks dropped, null when empty.
const normalizeLines = (v: string | null | undefined): string | null => {
  if (v === null || v === undefined) return null;
  const lines = v.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines.join('\n') : null;
};

const LIST_COLUMNS = ['alt_emails', 'alt_phones', 'urls'] as const;

// Default ordering: rows with a date first (DESC), then nulls, then by name.
const DEFAULT_ORDER = `(connected_on IS NULL), connected_on DESC, full_name ASC`;

export type SortKey = 'default' | 'name' | 'company' | 'industry' | 'connected' | 'last_contacted';
export type SortDir = 'asc' | 'desc';

// Builds an ORDER BY clause for a sortable column. NULLs always sort last, and
// full_name is the tiebreaker so the order is stable.
function buildOrder(sort: SortKey, dir: SortDir): string {
  const d = dir === 'desc' ? 'DESC' : 'ASC';
  switch (sort) {
    case 'name':
      return `ORDER BY full_name COLLATE NOCASE ${d}`;
    case 'company':
      return `ORDER BY (company IS NULL), company COLLATE NOCASE ${d}, full_name COLLATE NOCASE ASC`;
    case 'industry':
      return `ORDER BY (industry IS NULL), industry COLLATE NOCASE ${d}, full_name COLLATE NOCASE ASC`;
    case 'connected':
      return `ORDER BY (connected_on IS NULL), connected_on ${d}, full_name COLLATE NOCASE ASC`;
    case 'last_contacted':
      return `ORDER BY (last_contacted IS NULL), last_contacted ${d}, full_name COLLATE NOCASE ASC`;
    default:
      return `ORDER BY ${DEFAULT_ORDER}`;
  }
}

// Completeness filters for the list view. Each maps to a SQL predicate (or null
// for "no filter").
export type ContactFilter =
  | 'all'
  | 'email'
  | 'phone'
  | 'email_phone'
  | 'no_email'
  | 'no_phone'
  | 'has_notes'
  | 'name_is_email';

const FILTER_SQL: Record<ContactFilter, string | null> = {
  all: null,
  email: 'email IS NOT NULL',
  phone: 'phone IS NOT NULL',
  email_phone: 'email IS NOT NULL AND phone IS NOT NULL',
  no_email: 'email IS NULL',
  no_phone: 'phone IS NULL',
  has_notes: 'notes IS NOT NULL',
  name_is_email: "full_name LIKE '%@%'",
};

// Origin tags are free-form (whatever the importer recorded), matched as an
// exact token within the comma-separated `sources` column. 'untagged' selects
// rows with no tag at all.
const TAG_RE = /^[A-Za-z0-9_.-]+$/;

const SEARCH_COLUMNS = ['full_name', 'company', 'email', 'alt_emails', 'title', 'phone', 'alt_phones', 'notes', 'industry'];

export function listContacts(
  query?: string,
  filter: ContactFilter = 'all',
  sort: SortKey = 'default',
  dir: SortDir = 'asc',
  source: string = 'all',
  industry: string = 'all',
  opts: { limit?: number | null } = {}
): Contact[] {
  const db = getDb();
  const q = (query ?? '').trim();
  const conditions: string[] = [];
  const params: string[] = [];

  const filterSql = FILTER_SQL[filter] ?? null;
  if (filterSql) conditions.push(filterSql);

  if (source === 'untagged') {
    conditions.push('sources IS NULL');
  } else if (source !== 'all' && TAG_RE.test(source)) {
    conditions.push(`(',' || sources || ',') LIKE ?`);
    params.push(`%,${source},%`);
  }

  if (industry && industry !== 'all') {
    if (industry === 'none') {
      conditions.push('industry IS NULL');
    } else {
      conditions.push('industry = ?');
      params.push(industry);
    }
  }

  if (q.length > 0) {
    const like = `%${q.replace(/[%_\\]/g, (m) => '\\' + m)}%`;
    conditions.push(`(${SEARCH_COLUMNS.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(' OR ')})`);
    for (let i = 0; i < SEARCH_COLUMNS.length; i++) params.push(like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = buildOrder(sort, dir);
  // By default results are capped at 500 only when text-searching. Pass
  // `limit: null` for no cap, or a number for a fixed one.
  const cap = opts.limit === undefined ? (q.length > 0 ? 500 : null) : opts.limit;
  const limit = cap !== null && Number.isFinite(cap) && cap > 0 ? `LIMIT ${Math.floor(cap)}` : '';
  return db
    .prepare(`SELECT * FROM contacts ${where} ${order} ${limit}`)
    .all(...params) as unknown as Contact[];
}

export type ContactStats = {
  total: number;
  withEmail: number;
  withPhone: number;
  withBoth: number;
  withNotes: number;
  nameIsEmail: number;
};

// Bucket counts for the filter chips on the list view.
export function contactStats(): ContactStats {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) AS withEmail,
         SUM(CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END) AS withPhone,
         SUM(CASE WHEN email IS NOT NULL AND phone IS NOT NULL THEN 1 ELSE 0 END) AS withBoth,
         SUM(CASE WHEN notes IS NOT NULL THEN 1 ELSE 0 END) AS withNotes,
         SUM(CASE WHEN full_name LIKE '%@%' THEN 1 ELSE 0 END) AS nameIsEmail
       FROM contacts`
    )
    .get() as {
    total: number;
    withEmail: number;
    withPhone: number;
    withBoth: number;
    withNotes: number;
    nameIsEmail: number;
  };
  return {
    total: row.total,
    withEmail: row.withEmail ?? 0,
    withPhone: row.withPhone ?? 0,
    withBoth: row.withBoth ?? 0,
    withNotes: row.withNotes ?? 0,
    nameIsEmail: row.nameIsEmail ?? 0,
  };
}

export type SourceCount = { tag: string; count: number };

// Every origin tag present in the database with its contact count (most
// common first), plus how many rows carry no tag.
export function sourceCounts(): { tags: SourceCount[]; untagged: number } {
  const db = getDb();
  const rows = db.prepare(`SELECT sources FROM contacts WHERE sources IS NOT NULL`).all() as Array<{
    sources: string;
  }>;
  const tally = new Map<string, number>();
  for (const r of rows) {
    for (const t of r.sources.split(',')) {
      const tag = t.trim();
      if (tag) tally.set(tag, (tally.get(tag) ?? 0) + 1);
    }
  }
  const tags = [...tally]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  const untagged = (db.prepare(`SELECT COUNT(*) AS c FROM contacts WHERE sources IS NULL`).get() as {
    c: number;
  }).c;
  return { tags, untagged };
}

export type IndustryCount = { industry: string; count: number };

// Distinct industries with counts (most common first) plus the unclassified
// tally, for the industry filter chips.
export function industryCounts(): { industries: IndustryCount[]; unclassified: number } {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT industry, COUNT(*) AS count
       FROM contacts
       WHERE industry IS NOT NULL
       GROUP BY industry
       ORDER BY count DESC, industry ASC`
    )
    .all() as IndustryCount[];
  const unclassified = (
    db.prepare(`SELECT COUNT(*) AS c FROM contacts WHERE industry IS NULL`).get() as { c: number }
  ).c;
  return { industries: rows, unclassified };
}

export function getContact(id: number): Contact | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM contacts WHERE id = ?`).get(id) as
    | unknown as Contact
    | undefined;
  return row ?? null;
}

export function createContact(input: ContactInput): Contact {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO contacts (full_name, title, company, email, phone, alt_emails, alt_phones, urls,
                           notes, connected_on, last_contacted, industry)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const info = stmt.run(
    input.full_name.trim(),
    nullIfBlank(input.title),
    nullIfBlank(input.company),
    nullIfBlank(input.email),
    nullIfBlank(input.phone),
    normalizeLines(input.alt_emails),
    normalizeLines(input.alt_phones),
    normalizeLines(input.urls),
    nullIfBlank(input.notes),
    nullIfBlank(input.connected_on),
    nullIfBlank(input.last_contacted),
    nullIfBlank(input.industry)
  );
  return getContact(Number(info.lastInsertRowid))!;
}

export function updateContact(id: number, input: ContactInput): Contact | null {
  const db = getDb();
  const existing = getContact(id);
  if (!existing) return null;
  const sets = [
    'full_name = ?', 'title = ?', 'company = ?', 'email = ?', 'phone = ?',
    'notes = ?', 'connected_on = ?', 'last_contacted = ?', 'industry = ?',
  ];
  const params: Array<string | null | number> = [
    input.full_name.trim(),
    nullIfBlank(input.title),
    nullIfBlank(input.company),
    nullIfBlank(input.email),
    nullIfBlank(input.phone),
    nullIfBlank(input.notes),
    nullIfBlank(input.connected_on),
    nullIfBlank(input.last_contacted),
    nullIfBlank(input.industry),
  ];
  for (const col of LIST_COLUMNS) {
    if (input[col] !== undefined) {
      sets.push(`${col} = ?`);
      params.push(normalizeLines(input[col]));
    }
  }
  params.push(id);
  db.prepare(`UPDATE contacts SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);
  return getContact(id);
}

export function deleteContact(id: number): boolean {
  const db = getDb();
  const info = db.prepare(`DELETE FROM contacts WHERE id = ?`).run(id);
  return Number(info.changes) > 0;
}

// Changes whenever a contact is added, removed or edited, so the names list
// knows to fetch again after a save.
export function listVersion(): string {
  const db = getDb();
  const row = db
    .prepare(`SELECT COUNT(*) AS c, MAX(id) AS m, MAX(updated_at) AS u FROM contacts`)
    .get() as { c: number; m: number | null; u: string | null };
  return `${row.c}.${row.m ?? 0}.${row.u ?? ''}`;
}

export function countContacts(): number {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) AS c FROM contacts`).get() as { c: number };
  return row.c;
}
