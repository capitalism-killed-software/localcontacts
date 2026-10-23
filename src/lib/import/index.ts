import type { Format, ParseResult } from './types';
import { parseVcard } from './parsers/vcard';
import { parseGoogleCsv } from './parsers/google-csv';
import { parseOutlookCsv } from './parsers/outlook-csv';
import { parseLinkedInCsv } from './parsers/linkedin-csv';
import { parseTelegramJson } from './parsers/telegram-json';
import { parseGenericCsv, type FieldMap } from './parsers/generic-csv';

export type { Format, IncomingContact, ParseResult } from './types';
export { FORMAT_LABELS } from './types';
export { detect, decodeFileBytes, unknownHint } from './detect';
export { planMerge, rowToRec, recToColumns } from './merge';
export type { Batch, ExistingRow, MergeStats, Rec } from './merge';
export { parseFieldMap, MAPPABLE } from './parsers/generic-csv';
export type { FieldMap, MappableField } from './parsers/generic-csv';
export { defaultCountry } from './normalize';

export function parseText(text: string, format: Format, opts: { map?: FieldMap } = {}): ParseResult {
  switch (format) {
    case 'vcard':
      return parseVcard(text);
    case 'google-csv':
      return parseGoogleCsv(text);
    case 'outlook-csv':
      return parseOutlookCsv(text);
    case 'linkedin-csv':
      return parseLinkedInCsv(text);
    case 'telegram-json':
      return parseTelegramJson(text);
    case 'generic-csv':
      return parseGenericCsv(text, opts.map ?? {});
    default:
      throw new Error('unknown format');
  }
}

// Origin tag when --source is not given: what the file says about itself,
// else the format.
export function defaultSource(format: Format, hint: string | null): string {
  if (hint) return hint;
  switch (format) {
    case 'vcard':
      return 'vcard';
    case 'google-csv':
      return 'google';
    case 'outlook-csv':
      return 'outlook';
    case 'linkedin-csv':
      return 'linkedin';
    case 'telegram-json':
      return 'telegram';
    default:
      return 'csv';
  }
}
