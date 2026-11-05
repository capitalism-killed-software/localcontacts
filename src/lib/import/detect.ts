import { parse } from 'csv-parse/sync';
import type { Format } from './types';

export const stripBom = (s: string): string => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

const UTF8 = new TextDecoder('utf-8', { fatal: true });

const looksLikeVcard = (buf: Buffer): boolean => /^(\xef\xbb\xbf)?\s*BEGIN:VCARD/i.test(buf.subarray(0, 64).toString('latin1'));

// vCard folding (a line break followed by a space or tab) undone on the bytes,
// so a character whose bytes were split across two lines is whole again before
// it is decoded. The text-level unfolding in the parser then finds nothing left.
function unfoldVcardBytes(buf: Buffer): Buffer {
  const parts: Buffer[] = [];
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b !== 0x0a && b !== 0x0d) continue;
    let j = i + 1;
    if (b === 0x0d && buf[j] === 0x0a) j++;
    if (buf[j] === 0x20 || buf[j] === 0x09) {
      parts.push(buf.subarray(start, i));
      start = j + 1;
      i = j;
    } else {
      i = j - 1;
    }
  }
  if (start === 0) return buf;
  parts.push(buf.subarray(start));
  return Buffer.concat(parts);
}

function decoderFor(label: string): TextDecoder | null {
  try {
    return new TextDecoder(label);
  } catch {
    return null;
  }
}

export type DecodedFile = { text: string; note: string | null };

// Decode a file's bytes to text. UTF-16 byte-order marks (older Google and
// Outlook exports) are honoured and a UTF-8 one stripped. A file that is not
// valid UTF-8 (Excel's and classic Outlook's "CSV" are often Windows-1252) is
// read line by line: lines that are UTF-8 stay so, a vCard line's CHARSET= is
// used, and anything else is read as Windows-1252, with a note saying so.
export function decodeFile(input: Buffer): DecodedFile {
  if (input.length >= 2 && input[0] === 0xff && input[1] === 0xfe) return { text: input.subarray(2).toString('utf16le'), note: null };
  if (input.length >= 2 && input[0] === 0xfe && input[1] === 0xff) {
    return { text: Buffer.from(input.subarray(2)).swap16().toString('utf16le'), note: null };
  }
  const buf = looksLikeVcard(input) ? unfoldVcardBytes(input) : input;
  try {
    return { text: stripBom(UTF8.decode(buf)), note: null };
  } catch {
    // not UTF-8 throughout
  }
  const cp1252 = new TextDecoder('windows-1252');
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i < buf.length && buf[i] !== 0x0a) continue;
    const line = buf.subarray(start, i);
    let text: string;
    try {
      text = UTF8.decode(line);
    } catch {
      const charset = line.subarray(0, 200).toString('latin1').match(/^[^:]*;CHARSET=("?)([A-Za-z0-9_.:-]+)\1[;:]/i)?.[2];
      text = (charset && decoderFor(charset)?.decode(line)) || cp1252.decode(line);
    }
    out.push(text);
    start = i + 1;
  }
  return {
    text: stripBom(out.join('\n')),
    note: 'parts of this file are not UTF-8 and were read as Western European (Windows-1252); check accented names',
  };
}

export const decodeFileBytes = (buf: Buffer): string => decodeFile(buf).text;

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

// The separator a CSV uses: a comma, or the semicolon of European Excel, or a tab,
// whichever the header line has most of (outside quotes).
export function csvDelimiter(text: string): string {
  const line = csvBody(text).split(/\r?\n/, 1)[0] ?? '';
  const count: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQ = false;
  for (const c of line) {
    if (c === '"') inQ = !inQ;
    else if (!inQ && c in count) count[c]++;
  }
  const [best, n] = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ',';
}

function parseLine(line: string, delimiter: string): string[] {
  try {
    const rows = parse(line, { delimiter, relax_quotes: true, relax_column_count: true }) as string[][];
    return (rows[0] ?? []).map((c) => c.trim());
  } catch {
    return [];
  }
}

export function csvHeader(text: string): string[] {
  const firstLine = csvBody(text).split(/\r?\n/, 1)[0] ?? '';
  return firstLine.trim() ? parseLine(firstLine, csvDelimiter(text)) : [];
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
    records = parse(csvBody(text), { delimiter: csvDelimiter(text), to: 2, relax_quotes: true, relax_column_count: true, skip_empty_lines: true }) as string[][];
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
