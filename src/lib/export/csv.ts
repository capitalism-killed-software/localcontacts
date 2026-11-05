import type { Contact } from '../contacts';
import { NO_NAME } from '../constants';
import { guardCell } from '../csv-guard';

// CSV with one column per value (Email, Email 2, …) so it reads well in a
// spreadsheet and our own importer reads it back as a generic CSV. RFC 4180
// quoting, CRLF between records. Notes keep their line breaks inside quotes.

const lines = (v: string | null | undefined): string[] =>
  v ? v.split('\n').map((s) => s.trim()).filter(Boolean) : [];

export function csvCell(v: string | null | undefined): string {
  const s = v ?? '';
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const numbered = (base: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => (i === 0 ? base : `${base} ${i + 1}`));

export function contactsToCsv(list: Contact[], opts: { bom?: boolean; excel?: boolean } = {}): string {
  const excel = !!opts.excel;
  const rows = list.map((c) => ({
    c,
    emails: [c.email, ...lines(c.alt_emails)].filter((x): x is string => !!x),
    phones: [c.phone, ...lines(c.alt_phones)].filter((x): x is string => !!x),
    urls: lines(c.urls),
  }));
  const ne = Math.max(1, ...rows.map((r) => r.emails.length));
  const np = Math.max(1, ...rows.map((r) => r.phones.length));
  const nu = Math.max(1, ...rows.map((r) => r.urls.length));

  // No column is called "Created" or "Date": the importer would take it for
  // the connected-on date.
  const header = [
    'ID',
    'Name',
    ...numbered('Email', ne),
    ...numbered('Phone', np),
    'Company',
    'Title',
    ...numbered('URL', nu),
    'Notes',
    'Connected On',
    'Last Contacted',
    'Industry',
    'Sources',
  ];
  const pad = (xs: string[], n: number) => [...xs, ...Array(n - xs.length).fill('')];
  const body = rows.map(({ c, emails, phones, urls }) =>
    [
      `localcontacts-${c.id}`,
      c.full_name === NO_NAME ? '' : c.full_name,
      ...pad(emails, ne),
      ...pad(phones, np),
      c.company,
      c.title,
      ...pad(urls, nu),
      c.notes,
      c.connected_on,
      c.last_contacted,
      c.industry,
      c.sources,
    ]
      .map((v) => csvCell(guardCell(v, excel)))
      .join(',')
  );
  return (opts.bom ? '﻿' : '') + [header.map(csvCell).join(','), ...body].join('\r\n') + '\r\n';
}
