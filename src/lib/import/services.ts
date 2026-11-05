import { tagLabel } from '../groups';
import { FORMAT_LABELS, type Format } from './types';

// The services the guided import walks through: where the export steps are in
// docs/exporting-your-contacts.md, the vendor's page to open, which file
// formats their export comes in, and the group (tag) their cards go in. A
// service without a tag lets the file decide, as the import sheet does.

export type Service = {
  id: string;
  label: string;
  tag: string | null;
  section: string; // a "## " heading in the export guide
  exportUrl: string | null; // the vendor's page, linked from that section
  linkLabel?: string; // the words on the link to it
  formats: Format[]; // what its export looks like; anything else gets a warning, never a refusal
  hint: string;
  noExport?: boolean; // nothing to export: the hint says what to do instead
};

export const SERVICES: Service[] = [
  {
    id: 'google',
    label: 'Google Contacts',
    tag: 'google',
    section: 'Google Contacts',
    exportUrl: 'https://contacts.google.com',
    linkLabel: 'Open Google Contacts',
    formats: ['vcard', 'google-csv', 'outlook-csv'],
    hint: 'When Google asks for a format, vCard keeps the most.',
  },
  {
    id: 'apple',
    label: 'Apple (iCloud, Mac, iPhone)',
    tag: 'apple',
    section: 'Apple',
    exportUrl: 'https://www.icloud.com/contacts',
    linkLabel: 'Open iCloud Contacts',
    formats: ['vcard'],
    hint: 'iCloud has everything synced from your iPhone and Mac.',
  },
  {
    id: 'outlook',
    label: 'Outlook or Microsoft 365',
    tag: 'outlook',
    section: 'Microsoft: Outlook, Microsoft 365, Teams',
    exportUrl: 'https://support.microsoft.com/en-gb/office/578cca22-3550-4c73-b3f0-9978cfeac83f',
    linkLabel: 'Open Microsoft’s export steps',
    formats: ['outlook-csv', 'generic-csv', 'vcard'],
    hint: 'Import the file as it comes: opening and saving it in Excel first can damage it.',
  },
  {
    id: 'proton',
    label: 'Proton',
    tag: 'proton',
    section: 'Proton',
    exportUrl: 'https://account.proton.me',
    linkLabel: 'Open Proton',
    formats: ['vcard'],
    hint: 'Proton decrypts the contacts in your browser before saving them.',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    tag: 'linkedin',
    section: 'LinkedIn',
    exportUrl: 'https://www.linkedin.com/help/linkedin/answer/a566336',
    linkLabel: 'Open LinkedIn’s export help',
    formats: ['linkedin-csv'],
    hint: 'LinkedIn emails you a download link; the file inside is Connections.csv.',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    tag: 'telegram',
    section: 'Telegram',
    exportUrl: 'https://desktop.telegram.org',
    linkLabel: 'Get Telegram Desktop',
    formats: ['telegram-json'],
    hint: 'Only Telegram Desktop can export. The file is result.json.',
  },
  {
    id: 'android',
    label: 'Android or Samsung',
    tag: 'android',
    section: 'Android',
    exportUrl: 'https://support.google.com/contacts/answer/7199294?co=GENIE.Platform%3DAndroid',
    linkLabel: 'Open Google’s steps for Android',
    formats: ['vcard'],
    hint: 'If your contacts sync to Google, the Google export has them already.',
  },
  {
    id: 'mail',
    label: 'Yahoo, Thunderbird, Fastmail or Nextcloud',
    tag: null,
    section: 'Yahoo, Thunderbird, Fastmail, Nextcloud',
    exportUrl: null,
    formats: ['vcard', 'generic-csv', 'google-csv', 'outlook-csv'],
    hint: 'A vCard or CSV file from any of them.',
  },
  {
    id: 'spreadsheet',
    label: 'A CRM or a spreadsheet',
    tag: null,
    section: 'CRMs and spreadsheets',
    exportUrl: null,
    formats: ['generic-csv', 'google-csv', 'outlook-csv'],
    hint: 'Save it as CSV first. If the columns are not recognised, use Import… to choose them.',
  },
  {
    id: 'chat',
    label: 'Signal or WhatsApp',
    tag: null,
    section: 'Apps that do not export contacts',
    exportUrl: null,
    formats: [],
    hint: 'They have no export. They use your phone’s contacts, so export those (Apple or Android).',
    noExport: true,
  },
];

/** A note for a file that doesn't look like this service's export (it is imported all the same). */
export function slotWarning(service: Service, format: Format | undefined): string | null {
  if (!format || service.formats.length === 0 || service.formats.includes(format)) return null;
  const group = service.tag ? `, in the ${tagLabel(service.tag)} group` : '';
  return `This looks like a ${FORMAT_LABELS[format]}, not an export from ${service.label}. It can still be imported${group}.`;
}
