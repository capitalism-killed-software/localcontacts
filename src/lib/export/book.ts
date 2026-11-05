import { getPhoto, listContacts, type Contact } from '../contacts';
import { listArgs, parseBook } from '../context';
import { sectionize } from '../names';
import { contactsToCsv } from './csv';
import { attachmentHeader } from './filename';
import { contactToVcard } from './vcard';

// Exporting what the book shows: the same search, group and order as its URL
// parameters, with no row cap. Used by the export sheet (/api/export) and by
// `npm run export`.

export type ExportFormat = 'vcard' | 'csv';
export const isExportFormat = (v: unknown): v is ExportFormat => v === 'vcard' || v === 'csv';

/** Every card the book shows for these parameters, in its order. */
export function bookRows(params: URLSearchParams): Contact[] {
  const p = parseBook(params);
  const { sort, dir } = listArgs(p);
  const rows = listContacts(p.q, p.filter, sort, dir, p.source, p.industry, { limit: null });
  return p.viewSort === 'last' ? sectionize(rows, 'last').flatMap((s) => s.items.map((i) => i.contact)) : rows;
}

/** The cards as vCard 3.0, one at a time, so photos are read as they are written. */
export function* vcardChunks(rows: Contact[]): Generator<string> {
  for (const c of rows) yield contactToVcard(c, c.photo_type ? getPhoto(c.id) : null);
}

/** The whole export as text (the command line writes it to a file or stdout). */
export function exportBook(
  params: URLSearchParams,
  format: ExportFormat,
  opts: { bom?: boolean; excel?: boolean } = {}
): { count: number; text: string } {
  const rows = bookRows(params);
  const text = format === 'vcard' ? [...vcardChunks(rows)].join('') : contactsToCsv(rows, opts);
  return { count: rows.length, text };
}

/** A download name that says what is in it: contacts-linkedin-2026-11-04.csv. */
export function exportDisposition(params: URLSearchParams, format: ExportFormat, now = new Date()): string {
  const p = parseBook(params);
  const parts = ['contacts'];
  if (p.source !== 'all') parts.push(p.source);
  if (p.industry !== 'all') parts.push(p.industry);
  if (p.filter !== 'all') parts.push(p.filter.replace(/_/g, '-'));
  if (p.q) parts.push(p.q);
  const pad = (n: number) => String(n).padStart(2, '0');
  parts.push(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  return attachmentHeader(parts.join('-'), 0, format === 'vcard' ? 'vcf' : 'csv');
}
