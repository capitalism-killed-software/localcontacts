import { getDb } from './db';

export type Contact = {
  id: number;
  full_name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  connected_on: string | null;
  last_contacted: string | null;
  sources: string | null;
  industry: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactInput = {
  full_name: string;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
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

// Origin filter (which export a contact came from). Matched as an exact token
// within the comma-separated `sources` column.
export type ContactSource = 'all' | 'linkedin' | 'iphone' | 'google-personal' | 'google-work';
const SOURCE_TAGS = new Set<ContactSource>([
  'all',
  'linkedin',
  'iphone',
  'google-personal',
  'google-work',
]);

export function listContacts(
  query?: string,
  filter: ContactFilter = 'all',
  sort: SortKey = 'default',
  dir: SortDir = 'asc',
  source: ContactSource = 'all',
  industry: string = 'all'
): Contact[] {
  const db = getDb();
  const q = (query ?? '').trim();
  const conditions: string[] = [];
  const params: string[] = [];

  const filterSql = FILTER_SQL[filter] ?? null;
  if (filterSql) conditions.push(filterSql);

  if (source !== 'all' && SOURCE_TAGS.has(source)) {
    // Exact token match inside the comma-separated list.
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
    conditions.push(
      `(full_name LIKE ? ESCAPE '\\'
        OR company  LIKE ? ESCAPE '\\'
        OR email    LIKE ? ESCAPE '\\'
        OR title    LIKE ? ESCAPE '\\'
        OR phone    LIKE ? ESCAPE '\\'
        OR notes    LIKE ? ESCAPE '\\'
        OR industry LIKE ? ESCAPE '\\')`
    );
    for (let i = 0; i < 7; i++) params.push(like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = buildOrder(sort, dir);
  // Cap results only when text-searching (matches prior behavior); the unfiltered
  // browse view still lists everything.
  const limit = q.length > 0 ? 'LIMIT 500' : '';
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

export type SourceCounts = Record<Exclude<ContactSource, 'all'>, number> & { untagged: number };

// Per-origin contact counts for the source filter chips.
export function sourceCounts(): SourceCounts {
  const db = getDb();
  const count = (tag: string) =>
    (
      db
        .prepare(`SELECT COUNT(*) AS c FROM contacts WHERE (',' || sources || ',') LIKE ?`)
        .get(`%,${tag},%`) as { c: number }
    ).c;
  const untagged = (db.prepare(`SELECT COUNT(*) AS c FROM contacts WHERE sources IS NULL`).get() as {
    c: number;
  }).c;
  return {
    linkedin: count('linkedin'),
    iphone: count('iphone'),
    'google-personal': count('google-personal'),
    'google-work': count('google-work'),
    untagged,
  };
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
    `INSERT INTO contacts (full_name, title, company, email, phone, notes, connected_on, last_contacted, industry)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const info = stmt.run(
    input.full_name.trim(),
    nullIfBlank(input.title),
    nullIfBlank(input.company),
    nullIfBlank(input.email),
    nullIfBlank(input.phone),
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
  db.prepare(
    `UPDATE contacts
       SET full_name    = ?,
           title        = ?,
           company      = ?,
           email        = ?,
           phone        = ?,
           notes        = ?,
           connected_on = ?,
           last_contacted = ?,
           industry     = ?,
           updated_at   = datetime('now')
     WHERE id = ?`
  ).run(
    input.full_name.trim(),
    nullIfBlank(input.title),
    nullIfBlank(input.company),
    nullIfBlank(input.email),
    nullIfBlank(input.phone),
    nullIfBlank(input.notes),
    nullIfBlank(input.connected_on),
    nullIfBlank(input.last_contacted),
    nullIfBlank(input.industry),
    id
  );
  return getContact(id);
}

export function deleteContact(id: number): boolean {
  const db = getDb();
  const info = db.prepare(`DELETE FROM contacts WHERE id = ?`).run(id);
  return Number(info.changes) > 0;
}

export function countContacts(): number {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) AS c FROM contacts`).get() as { c: number };
  return row.c;
}
