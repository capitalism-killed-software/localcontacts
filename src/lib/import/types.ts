export type Format =
  | 'vcard'
  | 'google-csv'
  | 'outlook-csv'
  | 'linkedin-csv'
  | 'telegram-json'
  | 'generic-csv'
  | 'unknown';

export const FORMAT_LABELS: Record<Format, string> = {
  vcard: 'vCard',
  'google-csv': 'Google Contacts CSV',
  'outlook-csv': 'Outlook CSV',
  'linkedin-csv': 'LinkedIn Connections.csv',
  'telegram-json': 'Telegram export',
  'generic-csv': 'CSV',
  unknown: 'unknown',
};

// One contact as read from a file, before merging. Lists are in order of
// preference (the first email/phone becomes the primary one on insert).
export type IncomingContact = {
  name: string;
  emails: string[];
  phones: string[];
  org: string | null;
  title: string | null;
  notes: string | null;
  urls: string[];
  connected_on: string | null;
};

export type ParseResult = {
  contacts: IncomingContact[];
  // Human-readable notes about what the parser skipped or could not use.
  warnings: string[];
  // Origin tag suggested by the file itself (e.g. a vCard PRODID), used when
  // the caller does not pass --source.
  sourceHint: string | null;
};
