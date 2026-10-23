import type { IncomingContact, ParseResult } from '../types';
import { clean, dedupeEmails, isoDate, joinName } from '../normalize';
import { pick, readCsv } from './csv';

// LinkedIn "Connections.csv" from Settings → Data privacy → Get a copy of your
// data. Has no phone numbers, and an email only for connections who allowed it.

export function parseLinkedInCsv(text: string): ParseResult {
  const rows = readCsv(text);
  const contacts: IncomingContact[] = [];
  let skipped = 0;
  let noEmail = 0;

  for (const r of rows) {
    const name = joinName(pick(r, 'First Name'), pick(r, 'Last Name'));
    if (!name) {
      skipped++;
      continue;
    }
    const emails = dedupeEmails([r['Email Address'] ?? '']);
    if (emails.length === 0) noEmail++;
    const url = clean(r['URL']);
    contacts.push({
      name,
      emails,
      phones: [],
      org: pick(r, 'Company'),
      title: pick(r, 'Position'),
      notes: null,
      urls: url ? [url] : [],
      connected_on: isoDate(r['Connected On']),
    });
  }

  const warnings: string[] = [];
  if (noEmail) {
    warnings.push(
      `${noEmail} of ${contacts.length} connections have no email (LinkedIn only includes addresses that members chose to share)`
    );
  }
  if (skipped) warnings.push(`${skipped} row(s) without a name skipped`);
  return { contacts, warnings, sourceHint: 'linkedin' };
}
