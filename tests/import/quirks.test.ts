import { describe, expect, it } from 'vitest';
import { detect, parseText, planMerge, recToColumns, unknownHint, type IncomingContact } from '../../src/lib/import';

// Odd but real export quirks found in black-box testing.

const vcf = (...cards: string[][]) => cards.map((props) => ['BEGIN:VCARD', 'VERSION:3.0', ...props, 'END:VCARD'].join('\r\n')).join('\r\n') + '\r\n';
const opts = { country: 'US' as const };

describe('vCard quirks', () => {
  it('skips a vCard 2.1 AGENT’s embedded card instead of losing its owner', () => {
    const text = 'BEGIN:VCARD\r\nVERSION:2.1\r\nFN:Boss Person\r\nEMAIL:boss@example.com\r\nAGENT:\r\nBEGIN:VCARD\r\nVERSION:2.1\r\nFN:Assistant Person\r\nEND:VCARD\r\nTEL:+1 202 555 0115\r\nEND:VCARD\r\n';
    const r = parseText(text, 'vcard');
    expect(r.contacts).toHaveLength(1);
    expect(r.contacts[0]).toMatchObject({ name: 'Boss Person', emails: ['boss@example.com'], phones: ['+1 202 555 0115'] });
    expect(r.warnings.join(' ')).toMatch(/1 card\(s\) embedded in another card \(AGENT\) skipped/);
  });

  it('keeps a card that is never closed, and says so', () => {
    const cut = 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Whole One\r\nEND:VCARD\r\nBEGIN:VCARD\r\nVERSION:3.0\r\nFN:Cut Off\r\nEMAIL:cut@example.com\r\n';
    const r = parseText(cut, 'vcard');
    expect(r.contacts.map((c) => c.name)).toEqual(['Whole One', 'Cut Off']);
    expect(r.warnings.join(' ')).toMatch(/1 card\(s\) had no END:VCARD/);
    const run = parseText('BEGIN:VCARD\r\nFN:First\r\nBEGIN:VCARD\r\nFN:Second\r\nEND:VCARD\r\n', 'vcard');
    expect(run.contacts.map((c) => c.name)).toEqual(['First', 'Second']);
  });

  it('drops a NUL instead of cutting the name at it', () => {
    const r = parseText('BEGIN:VCARD\r\nVERSION:2.1\r\nFN;ENCODING=QUOTED-PRINTABLE:Before=00After\r\nEND:VCARD\r\n', 'vcard');
    expect(r.contacts[0].name).toBe('BeforeAfter');
  });

  it('skips group cards and reports their categories', () => {
    const r = parseText(vcf(
      ['FN:Coworkers', 'X-ADDRESSBOOKSERVER-KIND:group', 'X-ADDRESSBOOKSERVER-MEMBER:urn:uuid:1'],
      ['FN:Neighbours', 'KIND:group', 'MEMBER:urn:uuid:2'],
      ['FN:Ada Lovelace', 'EMAIL:ada@example.com', 'CATEGORIES:Family,Book Club'],
    ), 'vcard');
    expect(r.contacts.map((c) => c.name)).toEqual(['Ada Lovelace']);
    expect(r.warnings.join(' ')).toMatch(/2 group card\(s\) skipped/);
    expect(r.warnings.join(' ')).toMatch(/not imported: .*CATEGORIES ×1/);
  });

  it('lists what it does not keep, keeps social profile links, and reads every kind of name', () => {
    const r = parseText(vcf([
      'N:Lovelace;Ada;;Dr.;PhD', 'FN;PREF=2:Old Name', 'FN;PREF=1:Preferred Name', 'EMAIL:ada@example.com',
      'ORG:First Org;Research Dept', 'ORG:Second Org', 'TITLE:First', 'TITLE:Second', 'NICKNAME:Countess', 'ROLE:Analyst',
      'IMPP:xmpp:ada@example.com', 'X-SOCIALPROFILE;type=twitter:https://example.com/ada', 'X-SOCIALPROFILE:x-apple:ada',
      'X-ABLabel:_$!<Other>!$_', 'REV:2024-01-01T00:00:00Z', 'BDAY:1815-12-10',
    ], ['FN;ENCODING=b:QmFzZSBTaXh0eWZvdXI=', 'EMAIL:b64@example.com']), 'vcard');
    expect(r.contacts[0]).toMatchObject({ name: 'Preferred Name', org: 'First Org', title: 'First', urls: ['https://example.com/ada'] });
    expect(r.contacts[1].name).toBe('Base Sixtyfour');
    const note = r.warnings.find((w) => w.startsWith('not imported'))!;
    for (const p of ['NICKNAME', 'ROLE', 'IMPP', 'X-SOCIALPROFILE', 'a second ORG', 'ORG department', 'a second TITLE', 'BDAY']) expect(note).toContain(p);
    expect(note).not.toMatch(/X-ABLABEL|REV|addresses and birthdays/);
  });
});

describe('other formats', () => {
  it('keeps every Outlook phone column', () => {
    const cols = ['Pager', 'ISDN', 'Callback', 'Radio Phone', 'TTY/TDD Phone', "Assistant's Phone"];
    const text = `First Name,Last Name,E-mail Address,${cols.join(',')}\r\nAda,Lovelace,ada@example.com,${cols.map((_, i) => `+1 202 555 01${60 + i}`).join(',')}\r\n`;
    expect(detect(text)).toBe('outlook-csv');
    expect(parseText(text, 'outlook-csv').contacts[0].phones).toHaveLength(cols.length);
  });

  it('cleans up email values: mailto:, several in a cell, and things that are not addresses', () => {
    const r = parseText('Name,Email,Email 2\nMulti Mail,"a@example.com, b@example.com; c@example.com",mailto:d@example.com\nGrace,/o=ExchangeLabs/ou=Exchange/cn=Recipients/cn=grace,+1 202 555 0181\n', 'generic-csv');
    expect(r.contacts[0].emails).toEqual(['a@example.com', 'b@example.com', 'c@example.com', 'd@example.com']);
    expect(r.contacts[1].emails).toEqual([]);
  });

  it('merges a nameless Telegram entry with the named card that has its number', () => {
    const tg = parseText(JSON.stringify({ contacts: { list: [{ first_name: '', last_name: '', phone_number: '+1 202 555 0177' }] } }), 'telegram-json');
    expect(tg.contacts[0].name).toBe('(no name)');
    const named: IncomingContact = { name: 'Phil Phone', emails: [], phones: ['(202) 555-0177'], org: null, title: null, notes: null, urls: [], connected_on: null };
    for (const order of [[named, tg.contacts[0]], [tg.contacts[0], named]]) {
      const { rows } = planMerge([], order.map((c, i) => ({ source: i ? 'b' : 'a', contacts: [c] })), opts);
      expect(rows).toHaveLength(1);
      expect(recToColumns(rows[0]).full_name).toBe('Phil Phone');
    }
  });

  it('does not merge a nameless card into one of several people sharing its number', () => {
    const person = (name: string, email: string): IncomingContact => ({ name, emails: [email], phones: ['+1 202 555 0199'], org: null, title: null, notes: null, urls: [], connected_on: null });
    const desk: IncomingContact = { name: '(no name)', emails: [], phones: ['+1 202 555 0199'], org: null, title: null, notes: 'front desk', urls: [], connected_on: null };
    const shared = planMerge([], [{ source: 'a', contacts: [person('Alice Archer', 'alice@example.com'), person('Bob Brown', 'bob@example.com')] }, { source: 'b', contacts: [desk] }], opts);
    expect(shared.rows).toHaveLength(3);
    const single = planMerge([], [{ source: 'a', contacts: [person('Alice Archer', 'alice@example.com')] }, { source: 'b', contacts: [desk] }], opts);
    expect(single.rows).toHaveLength(1);
  });
});

describe('refusal reasons', () => {
  it('names what the file actually is', () => {
    expect(unknownHint('[1/2/24, 10:00:00] Alice: see you at 6', 'chat.txt')).toMatch(/Chat exports/);
    expect(unknownHint('[1/2/24, 10:00:00] Alice: hi', 'chat')).toMatch(/Chat exports/);
    expect(unknownHint('{"contacts": {"list": [', 'result.json')).toMatch(/damaged or cut off/);
    expect(unknownHint('Name,Email\n"Ada Lovelace,ada@example.com\n', 'x.csv')).toMatch(/quoted cell is never closed/);
    const png = '\u0089PNG\r\n\u001a\n\u0000\u0000\u0000\rIHDR\u0000\u0000';
    expect(detect(png)).toBe('unknown');
    expect(unknownHint(png, 'photo.csv')).toMatch(/binary file/);
  });
});
