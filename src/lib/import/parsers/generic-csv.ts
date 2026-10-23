import type { IncomingContact, ParseResult } from '../types';
import { clean, dedupeEmails, dedupePhones, dedupeStrings, defaultCountry, isoDate, joinName, NO_NAME } from '../normalize';
import { headersOf, readCsv, type Row } from './csv';

// Any CSV with a header row: a CRM export, a spreadsheet, another contacts app.
// Columns are guessed from common header names; --map overrides per field.

import { FIELD_LABELS, MAPPABLE, type FieldMap, type MappableField } from '../fields';
export { MAPPABLE, type FieldMap, type MappableField };

const MULTI: ReadonlySet<MappableField> = new Set(['email', 'phone', 'url']);

// "full_name=Name,email=Email Address" -> { full_name: 'Name', email: 'Email Address' }
export function parseFieldMap(spec: string): FieldMap {
  const map: FieldMap = {};
  for (const part of spec.split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) throw new Error(`bad --map entry "${part}": expected field=Column`);
    const field = part.slice(0, eq).trim() as MappableField;
    const column = part.slice(eq + 1).trim();
    if (!MAPPABLE.includes(field)) {
      throw new Error(`unknown field "${field}" in --map; use one of ${MAPPABLE.join(', ')}`);
    }
    if (!column) throw new Error(`empty column name for "${field}" in --map`);
    map[field] = column;
  }
  return map;
}

const norm = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const GUESS: Record<MappableField, (h: string) => boolean> = {
  full_name: (h) => ['name', 'full name', 'fullname', 'contact name', 'display name', 'contact', 'person'].includes(h),
  first_name: (h) => ['first name', 'firstname', 'given name', 'givenname', 'first'].includes(h),
  last_name: (h) => ['last name', 'lastname', 'surname', 'family name', 'familyname', 'last'].includes(h),
  email: (h) => /\be ?mail\b/.test(h) && !/\b(type|label)\b/.test(h),
  phone: (h) => /\b(phone|mobile|cell|telephone|tel)\b/.test(h) && !/\b(type|label|fax)\b/.test(h),
  company: (h) =>
    ['company', 'company name', 'organization', 'organisation', 'organization name', 'org', 'employer', 'account'].includes(h),
  title: (h) => ['title', 'job title', 'jobtitle', 'position', 'role', 'job'].includes(h),
  notes: (h) => ['notes', 'note', 'comments', 'comment', 'description', 'icp reason'].includes(h),
  url: (h) =>
    ['url', 'website', 'web page', 'web', 'linkedin', 'linkedin url', 'profile', 'profile url', 'link'].includes(h) ||
    /^(url|website|link) \d+$/.test(h),
  connected_on: (h) => ['connected on', 'connected', 'date', 'created', 'created at', 'added', 'date added', 'since'].includes(h),
  uid: (h) => ['id', 'uid', 'card id', 'contact id', 'record id'].includes(h),
};

function resolveColumns(headers: string[], map: FieldMap): Record<MappableField, string[]> {
  const out = {} as Record<MappableField, string[]>;
  for (const field of MAPPABLE) {
    const mapped = map[field];
    if (mapped) {
      if (!headers.includes(mapped)) {
        throw new Error(`column "${mapped}" (for ${field}) not found; headers are: ${headers.join(', ')}`);
      }
      out[field] = [mapped];
      continue;
    }
    const guessed = headers.filter((h) => GUESS[field](norm(h)));
    out[field] = MULTI.has(field) ? guessed : guessed.slice(0, 1);
  }
  return out;
}

const values = (r: Row, cols: string[]): string[] => cols.map((c) => clean(r[c])).filter((v): v is string => !!v);

export function parseGenericCsv(text: string, map: FieldMap = {}): ParseResult {
  const rows = readCsv(text);
  const headers = headersOf(rows);
  if (rows.length === 0) return { contacts: [], warnings: ['no data rows'], sourceHint: null };
  const cols = resolveColumns(headers, map);
  if (cols.full_name.length === 0 && cols.first_name.length === 0 && cols.last_name.length === 0) {
    throw new Error(
      `could not find a name column. Headers: ${headers.join(', ')}. ` +
        'Choose the name column (on the import page) or pass --map=full_name=<Column> (or first_name=…,last_name=…).'
    );
  }
  const country = defaultCountry();
  const contacts: IncomingContact[] = [];
  let skipped = 0;

  for (const r of rows) {
    const name =
      values(r, cols.full_name)[0] ??
      joinName(values(r, cols.first_name)[0], values(r, cols.last_name)[0]);
    const org = values(r, cols.company)[0] ?? null;
    const emails = dedupeEmails(values(r, cols.email));
    const phones = dedupePhones(values(r, cols.phone), country);
    const display = name ?? org;
    if (!display && emails.length === 0 && phones.length === 0) {
      skipped++;
      continue;
    }
    contacts.push({
      name: display ?? NO_NAME,
      emails,
      phones,
      org,
      title: values(r, cols.title)[0] ?? null,
      notes: values(r, cols.notes)[0] ?? null,
      urls: dedupeStrings(values(r, cols.url)),
      connected_on: isoDate(values(r, cols.connected_on)[0]),
      uid: values(r, cols.uid)[0] ?? null,
    });
  }

  const used = MAPPABLE.filter((f) => cols[f].length).map((f) => `${FIELD_LABELS[f]} ← ${cols[f].join(' + ')}`);
  const warnings = [`columns used: ${used.join('; ')}`];
  const unused = headers.filter((h) => !MAPPABLE.some((f) => cols[f].includes(h)));
  if (unused.length) warnings.push(`columns ignored: ${unused.join(', ')}`);
  if (skipped) warnings.push(`${skipped} empty row(s) skipped`);
  return { contacts, warnings, sourceHint: null };
}
