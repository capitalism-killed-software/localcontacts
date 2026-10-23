import { parse } from 'csv-parse/sync';
import { csvBody } from '../detect';
import { clean } from '../normalize';

export type Row = Record<string, string>;

export function readCsv(text: string): Row[] {
  const body = csvBody(text);
  if (!body.trim()) return [];
  return parse(body, {
    columns: (header: string[]) => header.map((h, i) => (h.trim() ? h.trim() : `column_${i + 1}`)),
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  }) as Row[];
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
