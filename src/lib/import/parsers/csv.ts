import { parse } from 'csv-parse/sync';
import { csvBody, csvDelimiter } from '../detect';
import { clean } from '../normalize';

export type Row = Record<string, string>;

// Header names made unique: a second "Email" column becomes "Email (2)", so
// both are read (the column guesses match either).
function uniqueHeaders(header: string[]): string[] {
  const seen = new Map<string, number>();
  return header.map((h, i) => {
    const name = h.trim() || `column_${i + 1}`;
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return n === 1 ? name : `${name} (${n})`;
  });
}

// Every row has every header column, in header order, even when the file
// leaves trailing cells out (so a short first row hides no columns).
export function readCsv(text: string): Row[] {
  const body = csvBody(text);
  if (!body.trim()) return [];
  let headers: string[] = [];
  const rows = parse(body, {
    delimiter: csvDelimiter(text),
    columns: (header: string[]) => (headers = uniqueHeaders(header)),
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  }) as Row[];
  return rows.map((r) => Object.fromEntries(headers.map((h) => [h, r[h] ?? ''])));
}

// First non-empty value among several candidate columns.
export function pick(r: Row, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = clean(r[k]);
    if (v) return v;
  }
  return null;
}

export const headersOf = (rows: Row[]): string[] => (rows.length ? Object.keys(rows[0]) : []);
