/**
 * Import contacts from a LinkedIn connections CSV and/or an Apple/iPhone .vcf
 * export into the local SQLite database.
 *
 * Usage:
 *   npm run import:sources -- <file1> <file2> ...
 *   npm run import:sources -- Connections.csv contacts.vcf
 *
 * Files are dispatched by extension (.csv = LinkedIn, .vcf = vCard) and never
 * modified or deleted. Records are de-duplicated and merged: a person matched
 * by email (preferred) or normalized full name is kept once, and any missing
 * email/phone/etc. is back-filled from the other source — including against the
 * contacts already in the database.
 */
import { parse } from 'csv-parse/sync';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { getDb } from '../src/lib/db';

type Rec = {
  id: number | null; // null = not yet in the DB (will be INSERTed)
  full_name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  connected_on: string | null;
  last_contacted: string | null;
  sources: string | null; // comma-separated origin tags
  dirty: boolean; // an existing row whose fields changed and needs UPDATE
};

const clean = (v: string | null | undefined): string | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
};

// Merge two comma-separated tag lists into a deduped, sorted list.
const unionCsv = (a: string | null, b: string | null): string | null => {
  const set = new Set<string>();
  for (const v of [a, b]) {
    if (v) for (const t of v.split(',')) { const x = t.trim(); if (x) set.add(x); }
  }
  return set.size ? [...set].sort().join(',') : null;
};

const emailKey = (r: Rec): string | null =>
  r.email ? r.email.toLowerCase().trim() : null;

// Loose name key for secondary matching: lowercase, strip punctuation, collapse
// whitespace. "Siddanth Arya, CPA" -> "siddanth arya cpa". Unicode-aware so
// non-Latin names (e.g. CJK) still produce a usable key instead of "".
const nameKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// ---------------------------------------------------------------------------
// LinkedIn CSV
// ---------------------------------------------------------------------------

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

// "16 Sep 2025" -> "2025-09-16"; returns the original string if it doesn't match.
function isoDate(v: string | null): string | null {
  const s = clean(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})$/);
  if (!m) return s;
  const mm = MONTHS[m[2].toLowerCase()];
  if (!mm) return s;
  return `${m[3]}-${mm}-${m[1].padStart(2, '0')}`;
}

function parseLinkedIn(raw: string, source: string): Rec[] {
  // LinkedIn prepends a few "Notes:" preamble lines before the real header.
  const lines = raw.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.startsWith('First Name,'));
  const body = headerIdx >= 0 ? lines.slice(headerIdx).join('\n') : raw;

  const rows: Record<string, string>[] = parse(body, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  const out: Rec[] = [];
  for (const r of rows) {
    const full_name = clean(
      [clean(r['First Name']), clean(r['Last Name'])].filter(Boolean).join(' ')
    );
    if (!full_name) continue; // full_name is NOT NULL
    const url = clean(r['URL']);
    out.push({
      id: null,
      full_name,
      title: clean(r['Position']),
      company: clean(r['Company']),
      email: clean(r['Email Address']),
      phone: null, // LinkedIn exports never contain phone numbers
      notes: url ? `LinkedIn: ${url}` : null,
      connected_on: isoDate(r['Connected On']),
      last_contacted: null,
      sources: source,
      dirty: false,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Apple / iPhone vCard (.vcf)
// ---------------------------------------------------------------------------

// Unescape RFC-6350 text values: \n \, \; \\
const unescapeText = (v: string): string =>
  v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

function parseVcf(raw: string, source: string): Rec[] {
  // Unfold: a line beginning with a space or tab continues the previous one.
  const unfolded: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  const out: Rec[] = [];
  let cur: Record<string, string[]> | null = null;

  for (const line of unfolded) {
    if (line === 'BEGIN:VCARD') {
      cur = {};
      continue;
    }
    if (line === 'END:VCARD') {
      if (cur) out.push(vcardToRec(cur, source));
      cur = null;
      continue;
    }
    if (!cur) continue;

    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const rawName = line.slice(0, colon);
    const value = line.slice(colon + 1);

    // Strip any "itemN." group prefix and uppercase the property name.
    const propWithParams = rawName.includes('.') ? rawName.slice(rawName.indexOf('.') + 1) : rawName;
    const prop = propWithParams.split(';')[0].toUpperCase();
    const isPref = /type=pref/i.test(rawName);

    // Stash with a pref marker so we can prefer the primary email/phone.
    const slot = isPref ? `${prop}__PREF` : prop;
    (cur[slot] ??= []).push(value);
  }
  return out;
}

function vcardToRec(card: Record<string, string[]>, source: string): Rec {
  const first = (key: string): string | null => {
    const pref = card[`${key}__PREF`];
    if (pref && pref.length) return clean(unescapeText(pref[0]));
    const any = card[key];
    return any && any.length ? clean(unescapeText(any[0])) : null;
  };

  // Name: prefer FN, else build "Given Family" from the structured N field.
  let full_name = first('FN');
  if (!full_name) {
    const n = (card['N__PREF']?.[0] ?? card['N']?.[0] ?? '').split(';');
    full_name = clean([clean(n[1]), clean(n[0])].filter(Boolean).join(' '));
  }

  // ORG may be "Company;Department" — keep the first non-empty component.
  let company: string | null = null;
  const org = card['ORG__PREF']?.[0] ?? card['ORG']?.[0];
  if (org) company = clean(unescapeText(org).split(';').map((s) => s.trim()).filter(Boolean)[0] ?? '');

  return {
    id: null,
    full_name: full_name ?? '(no name)',
    title: first('TITLE'),
    company,
    email: first('EMAIL'),
    phone: first('TEL'),
    notes: first('NOTE'),
    connected_on: null,
    last_contacted: null,
    sources: source,
    dirty: false,
  };
}

// ---------------------------------------------------------------------------
// Merge engine
// ---------------------------------------------------------------------------

const stats = {
  parsedLinkedIn: 0,
  parsedVcf: 0,
  inserted: 0,
  skippedUnmatched: 0,
  mergedIntoExisting: 0,
  mergedWithinImport: 0,
  filledEmail: 0,
  filledPhone: 0,
};

function mergeInto(target: Rec, incoming: Rec): boolean {
  let changed = false;
  const fill = (field: keyof Rec, track?: () => void) => {
    if (target[field] == null && incoming[field] != null) {
      (target as Record<string, unknown>)[field] = incoming[field];
      changed = true;
      track?.();
    }
  };
  fill('title');
  fill('company');
  fill('email', () => stats.filledEmail++);
  fill('phone', () => stats.filledPhone++);
  fill('connected_on');
  fill('last_contacted');

  // Notes: concatenate distinct fragments rather than overwriting.
  if (incoming.notes && incoming.notes !== target.notes) {
    if (!target.notes) {
      target.notes = incoming.notes;
      changed = true;
    } else if (!target.notes.includes(incoming.notes)) {
      target.notes = `${target.notes}\n${incoming.notes}`;
      changed = true;
    }
  }

  // Sources: accumulate the union of origin tags.
  const mergedSources = unionCsv(target.sources, incoming.sources);
  if (mergedSources !== target.sources) {
    target.sources = mergedSources;
    changed = true;
  }
  return changed;
}

// Infer an origin tag from the file name; overridable with `--source=<tag>`.
function sourceFor(path: string): string {
  const base = path.toLowerCase();
  if (base.includes('linkedin')) return 'linkedin';
  if (base.includes('iphone')) return 'iphone';
  if (base.includes('work')) return 'google-work';
  if (base.endsWith('.vcf')) return 'google-personal';
  return 'import';
}

function main() {
  const args = process.argv.slice(2);
  // Optional `--source=<tag>` applies one tag to every file in this run;
  // otherwise each file's tag is inferred from its name.
  const sourceFlag = args.find((a) => a.startsWith('--source='))?.slice('--source='.length) || null;
  // Tag-only: update `sources` on rows that already match, never insert new
  // rows. Used to back-fill origin tags onto an existing database without
  // reintroducing contacts that were since renamed/merged.
  const tagOnly = args.includes('--tag-only');
  const paths = args
    .filter((a) => !a.startsWith('--'))
    .map((p) => resolve(p.replace(/^~/, process.env.HOME ?? '~')));
  if (paths.length === 0) {
    console.error('Usage: npm run import:sources -- [--source=<tag>] [--tag-only] <file.csv|file.vcf> ...');
    process.exit(1);
  }

  // Parse all sources. VCF first so its richer data (email + phone) seeds the
  // records that LinkedIn rows then back-fill.
  const incoming: Rec[] = [];
  const vcfPaths = paths.filter((p) => extname(p).toLowerCase() === '.vcf');
  const csvPaths = paths.filter((p) => extname(p).toLowerCase() === '.csv');
  for (const p of [...vcfPaths, ...csvPaths]) {
    if (!existsSync(p)) {
      console.error(`File not found: ${p}`);
      process.exit(1);
    }
    const raw = readFileSync(p, 'utf-8');
    const source = sourceFlag ?? sourceFor(p);
    if (extname(p).toLowerCase() === '.vcf') {
      const recs = parseVcf(raw, source);
      stats.parsedVcf += recs.length;
      incoming.push(...recs);
    } else {
      const recs = parseLinkedIn(raw, source);
      stats.parsedLinkedIn += recs.length;
      incoming.push(...recs);
    }
  }

  const db = getDb();
  const before = (db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c;

  // Load existing rows into the in-memory index so imports merge against them.
  const existing = db
    .prepare(
      'SELECT id, full_name, title, company, email, phone, notes, connected_on, last_contacted, sources FROM contacts'
    )
    .all() as Array<Omit<Rec, 'dirty'>>;

  const byEmail = new Map<string, Rec>();
  const byName = new Map<string, Rec>();
  const all: Rec[] = [];

  const indexRec = (r: Rec) => {
    const ek = emailKey(r);
    if (ek && !byEmail.has(ek)) byEmail.set(ek, r);
    const nk = nameKey(r.full_name);
    if (nk && !byName.has(nk)) byName.set(nk, r);
  };

  for (const e of existing) {
    const r: Rec = { ...e, dirty: false };
    all.push(r);
    indexRec(r);
  }

  for (const inc of incoming) {
    const ek = emailKey(inc);
    let target: Rec | undefined = ek ? byEmail.get(ek) : undefined;
    if (!target) target = byName.get(nameKey(inc.full_name));

    if (target) {
      // Tag-only: union the source tag and nothing else. Full mode: fill gaps
      // (which also unions sources via mergeInto).
      const changed = tagOnly
        ? (() => {
            const u = unionCsv(target!.sources, inc.sources);
            if (u === target!.sources) return false;
            target!.sources = u;
            return true;
          })()
        : mergeInto(target, inc);
      if (changed) {
        if (target.id !== null) {
          target.dirty = true;
          stats.mergedIntoExisting++;
        } else {
          stats.mergedWithinImport++;
        }
        // The target may have just gained an email — index it for later rows.
        indexRec(target);
      }
    } else if (tagOnly) {
      // No existing match — don't introduce a new row in tag-only mode.
      stats.skippedUnmatched++;
    } else {
      all.push(inc);
      indexRec(inc);
      stats.inserted++;
    }
  }

  // Write phase.
  const insert = db.prepare(`
    INSERT INTO contacts (full_name, title, company, email, phone, notes, connected_on, last_contacted, sources)
    VALUES (@full_name, @title, @company, @email, @phone, @notes, @connected_on, @last_contacted, @sources)
  `);
  const update = db.prepare(`
    UPDATE contacts SET
      full_name = @full_name, title = @title, company = @company, email = @email,
      phone = @phone, notes = @notes, connected_on = @connected_on,
      last_contacted = @last_contacted, sources = @sources, updated_at = datetime('now')
    WHERE id = @id
  `);

  db.exec('BEGIN');
  try {
    for (const r of all) {
      // node:sqlite rejects param objects carrying keys the statement omits,
      // so build the exact shape each statement expects.
      if (r.id === null) {
        insert.run({
          full_name: r.full_name,
          title: r.title,
          company: r.company,
          email: r.email,
          phone: r.phone,
          notes: r.notes,
          connected_on: r.connected_on,
          last_contacted: r.last_contacted,
          sources: r.sources,
        });
      } else if (r.dirty) {
        update.run({
          id: r.id,
          full_name: r.full_name,
          title: r.title,
          company: r.company,
          email: r.email,
          phone: r.phone,
          notes: r.notes,
          connected_on: r.connected_on,
          last_contacted: r.last_contacted,
          sources: r.sources,
        });
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const after = (db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c;
  const missingEmail = (db.prepare('SELECT COUNT(*) AS c FROM contacts WHERE email IS NULL').get() as { c: number }).c;
  const missingPhone = (db.prepare('SELECT COUNT(*) AS c FROM contacts WHERE phone IS NULL').get() as { c: number }).c;

  console.log('Sources                :', paths.join(', '));
  console.log('Parsed (LinkedIn)      :', stats.parsedLinkedIn);
  console.log('Parsed (vCard)         :', stats.parsedVcf);
  console.log('New contacts inserted  :', stats.inserted);
  console.log('Skipped (tag-only)     :', stats.skippedUnmatched);
  console.log('Merged into existing   :', stats.mergedIntoExisting);
  console.log('Merged within import   :', stats.mergedWithinImport);
  console.log('Gaps filled — email    :', stats.filledEmail);
  console.log('Gaps filled — phone    :', stats.filledPhone);
  console.log('DB before / after      :', `${before} / ${after}`);
  console.log('Flagged (yellow) email :', missingEmail);
  console.log('Flagged (yellow) phone :', missingPhone);
}

main();
