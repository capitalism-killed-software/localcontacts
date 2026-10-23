import type { IncomingContact, ParseResult } from '../types';
import { clean, dedupeEmails, dedupePhones, dedupeStrings, defaultCountry, joinName, NO_NAME } from '../normalize';
import { headersOf, pick, readCsv, type Row } from './csv';

// Google Contacts CSV, both the current layout ("First Name,Middle Name,Last
// Name,…,E-mail 1 - Value") and the older one ("Name,Given Name,…"). Several
// values in one cell are separated by " ::: ".

const numbered = (headers: string[], re: RegExp): string[] =>
  headers
    .filter((h) => re.test(h))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0));

const multi = (r: Row, cols: string[]): string[] =>
  cols.flatMap((c) => (r[c] ?? '').split(' ::: ')).map((s) => s.trim()).filter(Boolean);

export function parseGoogleCsv(text: string): ParseResult {
  const rows = readCsv(text);
  const headers = headersOf(rows);
  const emailCols = numbered(headers, /^E-mail \d+ - Value$/i);
  const phoneCols = numbered(headers, /^Phone \d+ - Value$/i);
  const siteCols = numbered(headers, /^Website \d+ - Value$/i);
  const country = defaultCountry();
  const contacts: IncomingContact[] = [];
  let skipped = 0;

  for (const r of rows) {
    const name =
      pick(r, 'Name') ??
      joinName(pick(r, 'First Name', 'Given Name'), pick(r, 'Middle Name', 'Additional Name'), pick(r, 'Last Name', 'Family Name'));
    const org = pick(r, 'Organization Name', 'Organization 1 - Name');
    const title = pick(r, 'Organization Title', 'Organization 1 - Title');
    const emails = dedupeEmails(multi(r, emailCols));
    const phones = dedupePhones(multi(r, phoneCols), country);
    const urls = dedupeStrings(multi(r, siteCols));
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
      title,
      notes: clean(r['Notes']),
      urls,
      connected_on: null,
    });
  }

  const warnings: string[] = [];
  if (rows.length && emailCols.length === 0 && phoneCols.length === 0) {
    warnings.push('no "E-mail N - Value" or "Phone N - Value" columns found; is this a Google Contacts export?');
  }
  if (skipped) warnings.push(`${skipped} empty row(s) skipped`);
  return { contacts, warnings, sourceHint: 'google' };
}
