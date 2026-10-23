import { parse } from 'csv-parse/sync';
import type { Format } from './types';

export const stripBom = (s: string): string => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

// Decode a file's bytes to text, honouring UTF-16 byte-order marks (older
// Google and Outlook exports) and stripping a UTF-8 one.
export function decodeFileBytes(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  }
  return stripBom(buf.toString('utf-8'));
}

// The CSV text from its header row onward. LinkedIn's Connections.csv opens
// with a "Notes:" paragraph and a blank line before the real header.
export function csvBody(text: string): string {
  const t = stripBom(text);
  if (/^\s*Notes:/i.test(t)) {
    const lines = t.split(/\r?\n/);
    const blank = lines.findIndex((l, i) => i > 0 && l.trim() === '');
    if (blank >= 0) return lines.slice(blank + 1).join('\n').replace(/^\s+/, '');
  }
  return t.replace(/^\s+/, '');
}

function parseLine(line: string): string[] {
  try {
    const rows = parse(line, { relax_quotes: true, relax_column_count: true }) as string[][];
    return (rows[0] ?? []).map((c) => c.trim());
  } catch {
    return [];
  }
}

export function csvHeader(text: string): string[] {
  const firstLine = csvBody(text).split(/\r?\n/, 1)[0] ?? '';
  return firstLine.trim() ? parseLine(firstLine) : [];
}

// A plausible CSV: at least two named header cells, and a first data row
// (when there is one) that is also delimited. Prose with a comma in its first
// line fails this.
function looksTabular(text: string): boolean {
  const cols = csvHeader(text);
  if (cols.filter((c) => c.length > 0).length < 2) return false;
  // Read the first two records, not lines: a quoted cell may span lines.
  let records: string[][];
  try {
    records = parse(csvBody(text), { to: 2, relax_quotes: true, relax_column_count: true, skip_empty_lines: true }) as string[][];
  } catch {
    return false;
  }
  if (records.length < 2) return true;
  return records[1].length >= 2;
}

// Decide the format from the content, never from the file extension.
export function detect(text: string): Format {
  const t = stripBom(text).trimStart();
  if (/^BEGIN:VCARD/i.test(t)) return 'vcard';
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const j = JSON.parse(t) as { contacts?: { list?: unknown } };
      if (j && typeof j === 'object' && Array.isArray(j.contacts?.list)) return 'telegram-json';
    } catch {
      // not JSON after all
    }
    return 'unknown';
  }
  if (!looksTabular(t)) return 'unknown';
  const cols = csvHeader(t).map((c) => c.toLowerCase());
  const has = (...names: string[]) => names.every((n) => cols.includes(n));
  if (has('first name', 'last name', 'url', 'email address', 'connected on')) return 'linkedin-csv';
  if (cols[0] === 'name' && has('given name', 'family name')) return 'google-csv';
  if (cols.some((c) => /^(e-mail|phone) \d+ - (value|label|type)$/.test(c))) return 'google-csv';
  if (has('first name', 'e-mail address')) return 'outlook-csv';
  return 'generic-csv';
}

// Why a file was not recognised, phrased for the person running the import.
export function unknownHint(text: string, filename: string): string {
  const t = stripBom(text).trimStart();
  const ext = (filename.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
  if (t.startsWith('{') || t.startsWith('[')) {
    return 'looks like JSON but not a Telegram export (expected a contacts.list array). Only Telegram\'s result.json is supported as JSON.';
  }
  if (ext === 'xlsx' || ext === 'xls' || ext === 'numbers') {
    return 'spreadsheets are not read directly. Save it as CSV first.';
  }
  if (ext === 'ldif') return 'LDIF is not supported. Export as vCard or CSV instead.';
  if (ext === 'txt' || ext === 'html') {
    return 'not a contact export. Chat exports (WhatsApp, Signal) contain messages, not contacts; export your phone\'s address book as vCard instead.';
  }
  return 'not recognised. Supported: vCard (.vcf), Google Contacts CSV, Outlook CSV, LinkedIn Connections.csv, Telegram result.json, or any CSV with a header row.';
}
