import { describe, expect, it } from 'vitest';
import type { Contact } from '../../src/lib/contacts';
import { contactToVcard, contactsToVcf, escapeText, foldLine } from '../../src/lib/export/vcard';
import { parseText } from '../../src/lib/import';

const base: Contact = {
  id: 1, full_name: 'Ada Lovelace', title: null, company: null, email: null, phone: null,
  alt_emails: null, alt_phones: null, urls: null, notes: null, connected_on: null,
  last_contacted: null, sources: null, industry: null, created_at: '2026-01-01 00:00:00',
  updated_at: '2026-10-22 12:34:56',
};
const c = (over: Partial<Contact>): Contact => ({ ...base, ...over });

describe('escapeText', () => {
  it('escapes backslash, newline, comma and semicolon', () => {
    expect(escapeText('a\\b\nc,d;e')).toBe('a\\\\b\\nc\\,d\\;e');
    expect(escapeText('x\r\ny')).toBe('x\\ny');
  });
});

describe('foldLine', () => {
  it('keeps every physical line within 75 octets and never splits a character', () => {
    const line = 'NOTE:' + 'Zoë 李雷 🙂 '.repeat(40);
    const parts = foldLine(line).split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const [i, p] of parts.entries()) {
      expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(75);
      if (i > 0) expect(p.startsWith(' ')).toBe(true);
      expect(Buffer.from(p, 'utf8').toString('utf8')).toBe(p);
    }
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
  });
  it('leaves short lines alone', () => {
    expect(foldLine('FN:Ada')).toBe('FN:Ada');
  });
});

describe('contactToVcard', () => {
  it('writes every field, CRLF only, and reads back through the importer', () => {
    const card = c({
      full_name: 'Mary Ann Smith Jr.',
      company: 'AT&T; Labs',
      title: 'Engineer, Networks',
      email: 'mary@example.com',
      alt_emails: 'mary.home@example.com',
      phone: '+1 202 555 0171',
      alt_phones: '+1 202 555 0172',
      urls: 'https://example.com/mary\nhttps://example.com/blog',
      notes: 'Path C:\\new\nsecond, line; here',
      industry: 'Legal',
      sources: 'apple,linkedin',
      connected_on: '2024-01-15',
      last_contacted: '2026-10-01',
    });
    const text = contactToVcard(card);
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(text).toContain('N:Smith;Mary Ann;;;Jr.\r\n');
    expect(text).toContain('ORG:AT&T\\; Labs\r\n');
    expect(text).toContain('EMAIL;TYPE=INTERNET;TYPE=PREF:mary@example.com\r\n');
    expect(text).toContain('TEL;TYPE=PREF:+1 202 555 0171\r\n');
    expect(text).toContain('CATEGORIES:Legal,apple,linkedin\r\n');
    expect(text).toContain('X-LOCALCONTACTS-CONNECTED:2024-01-15\r\n');
    expect(text).toContain('REV:2026-10-22T12:34:56Z\r\n');
    expect(text).toContain('PRODID:-//localcontacts//EN\r\n');

    const back = parseText(text, 'vcard');
    expect(back.sourceHint).toBeNull();
    expect(back.contacts[0]).toEqual({
      name: 'Mary Ann Smith Jr.',
      emails: ['mary@example.com', 'mary.home@example.com'],
      phones: ['+1 202 555 0171', '+1 202 555 0172'],
      org: 'AT&T; Labs',
      title: 'Engineer, Networks',
      notes: 'Path C:\\new\nsecond, line; here',
      urls: ['https://example.com/mary', 'https://example.com/blog'],
      connected_on: '2024-01-15',
      last_contacted: '2026-10-01',
      industry: 'Legal',
      uid: 'localcontacts-1',
      photo: null,
      sources: ['apple', 'linkedin'], // the groups come back; the industry is not one of them
    });
    // Another app's CATEGORIES are its own labels, not our groups.
    const foreign = parseText(text.replace('PRODID:-//localcontacts//EN', 'PRODID:-//Apple Inc.//iPhone OS 17//EN'), 'vcard');
    expect(foreign.contacts[0].sources).toBeUndefined();
  });

  it('writes a company’s own card as a company, not as a person called "Plumbing"', () => {
    const text = contactToVcard(c({ full_name: 'Acme Plumbing', company: 'Acme Plumbing' }));
    expect(text).toContain('N:;;;;\r\n');
    expect(text).toContain('FN:Acme Plumbing\r\n');
    expect(text).toContain('X-ABShowAs:COMPANY\r\n');
    expect(contactToVcard(c({ full_name: 'Paul Plumber', company: 'Acme Plumbing' }))).toContain('N:Plumber;Paul;;;\r\n');
  });

  it('falls back to company, email or phone for a nameless card', () => {
    expect(contactToVcard(c({ full_name: '(no name)', email: 'x@example.com' }))).toContain('FN:x@example.com\r\n');
    expect(contactToVcard(c({ full_name: '(no name)', company: 'Acme', email: 'x@example.com' }))).toContain('FN:Acme\r\n');
    expect(contactToVcard(c({ full_name: '(no name)', phone: '+1 202 555 0100' }))).toContain('N:;;;;\r\n');
  });

  it('writes a name-only card', () => {
    const text = contactToVcard(c({ full_name: 'Cher' }));
    expect(text).toContain('N:;Cher;;;\r\n');
    expect(parseText(text, 'vcard').contacts[0].name).toBe('Cher');
  });

  it('concatenates several cards', () => {
    const text = contactsToVcf([c({ id: 1 }), c({ id: 2, full_name: 'Grace Hopper' })]);
    expect(text.match(/BEGIN:VCARD/g)).toHaveLength(2);
    expect(parseText(text, 'vcard').contacts.map((x) => x.name)).toEqual(['Ada Lovelace', 'Grace Hopper']);
  });
});
