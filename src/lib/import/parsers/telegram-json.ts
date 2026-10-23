import type { IncomingContact, ParseResult } from '../types';
import { stripBom } from '../detect';
import { clean, dedupePhones, defaultCountry, isoDate, joinName } from '../normalize';

// Telegram Desktop → Settings → Advanced → Export Telegram data, with
// "Contacts" ticked and JSON as the format. Contacts carry a name and a phone.

type TgContact = { first_name?: string; last_name?: string; phone_number?: string; date?: string };

export function parseTelegramJson(text: string): ParseResult {
  const j = JSON.parse(stripBom(text)) as { contacts?: { list?: TgContact[] } };
  const list = j?.contacts?.list;
  if (!Array.isArray(list)) throw new Error('not a Telegram export: no contacts.list array');
  const country = defaultCountry();
  const contacts: IncomingContact[] = [];
  let skipped = 0;

  for (const c of list) {
    const name = joinName(c.first_name, c.last_name);
    const phone = clean(c.phone_number);
    if (!name && !phone) {
      skipped++;
      continue;
    }
    contacts.push({
      name: name ?? phone!,
      emails: [],
      phones: phone ? dedupePhones([phone], country) : [],
      org: null,
      title: null,
      notes: null,
      urls: [],
      connected_on: typeof c.date === 'string' ? isoDate(c.date) : null,
    });
  }

  const warnings: string[] = [];
  if (skipped) warnings.push(`${skipped} empty entr${skipped === 1 ? 'y' : 'ies'} skipped`);
  return { contacts, warnings, sourceHint: 'telegram' };
}
