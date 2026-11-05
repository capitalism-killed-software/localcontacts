import type { IncomingContact, ParseResult } from '../types';
import { clean, dedupeEmails, dedupePhones, dedupeStrings, defaultCountry, joinName, NO_NAME } from '../normalize';
import { pick, readCsv, type Row } from './csv';

// Outlook desktop and Outlook.com / Microsoft 365 "Export contacts" CSV.

const EMAIL_COLS = ['E-mail Address', 'E-mail 2 Address', 'E-mail 3 Address'];
const PHONE_COLS = [
  'Mobile Phone', 'Primary Phone', 'Business Phone', 'Business Phone 2',
  'Home Phone', 'Home Phone 2', 'Other Phone', 'Car Phone', 'Company Main Phone',
  'Pager', 'ISDN', 'Callback', 'Radio Phone', 'TTY/TDD Phone', "Assistant's Phone",
];
const URL_COLS = ['Web Page', 'Personal Web Page', 'Business Web Page'];

const values = (r: Row, cols: string[]): string[] => cols.map((c) => clean(r[c])).filter((v): v is string => !!v);

export function parseOutlookCsv(text: string): ParseResult {
  const rows = readCsv(text);
  const country = defaultCountry();
  const contacts: IncomingContact[] = [];
  let skipped = 0;

  for (const r of rows) {
    const name = joinName(pick(r, 'First Name'), pick(r, 'Middle Name'), pick(r, 'Last Name'));
    const org = pick(r, 'Company');
    const emails = dedupeEmails(values(r, EMAIL_COLS));
    const phones = dedupePhones(values(r, PHONE_COLS), country);
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
      title: pick(r, 'Job Title'),
      notes: pick(r, 'Notes'),
      urls: dedupeStrings(values(r, URL_COLS)),
      connected_on: null,
    });
  }

  const warnings: string[] = [];
  if (skipped) warnings.push(`${skipped} empty row(s) skipped`);
  return { contacts, warnings, sourceHint: 'outlook' };
}
