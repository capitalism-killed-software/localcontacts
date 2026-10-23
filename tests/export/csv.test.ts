import { describe, expect, it } from 'vitest';
import type { Contact } from '../../src/lib/contacts';
import { contactsToCsv, csvCell } from '../../src/lib/export/csv';
import { detect, parseText } from '../../src/lib/import';

const base: Contact = {
  id: 1, full_name: 'Ada Lovelace', title: null, company: null, email: null, phone: null,
  alt_emails: null, alt_phones: null, urls: null, notes: null, connected_on: null,
  last_contacted: null, sources: null, industry: null, created_at: '', updated_at: '',
};
const c = (over: Partial<Contact>): Contact => ({ ...base, ...over });

describe('csvCell', () => {
  it('quotes only when needed and doubles quotes', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(' padded')).toBe('" padded"');
    expect(csvCell(null)).toBe('');
  });
});

describe('contactsToCsv', () => {
  const list = [
    c({
      full_name: 'Ada Lovelace',
      email: 'ada@example.com',
      alt_emails: 'ada.home@example.com',
      phone: '+1 202 555 0101',
      company: 'Analytical Engines, Ltd',
      title: 'Head of Engineering',
      urls: 'https://a.example\nhttps://b.example',
      notes: 'line one\nline "two"',
      connected_on: '2024-01-15',
      industry: 'Software / Technology',
      sources: 'google,linkedin',
    }),
    c({ id: 2, full_name: '(no name)', phone: '+1 202 555 0102', company: 'Acme' }),
  ];

  it('writes numbered columns sized to the widest contact, CRLF between records', () => {
    const text = contactsToCsv(list);
    const header = text.split('\r\n')[0];
    expect(header).toBe('Name,Email,Email 2,Phone,Company,Title,URL,URL 2,Notes,Connected On,Last Contacted,Industry,Sources');
    expect(text.endsWith('\r\n')).toBe(true);
    expect(contactsToCsv(list, { bom: true }).charCodeAt(0)).toBe(0xfeff);
  });

  it('is recognised as a generic CSV even with a multi-line note in the first row, and reads back', () => {
    const text = contactsToCsv(list);
    expect(detect(text)).toBe('generic-csv');
    const back = parseText(text, 'generic-csv').contacts;
    expect(back[0]).toMatchObject({
      name: 'Ada Lovelace',
      emails: ['ada@example.com', 'ada.home@example.com'],
      phones: ['+1 202 555 0101'],
      org: 'Analytical Engines, Ltd',
      title: 'Head of Engineering',
      urls: ['https://a.example', 'https://b.example'],
      notes: 'line one\nline "two"',
      connected_on: '2024-01-15',
    });
    expect(back[1]).toMatchObject({ name: 'Acme', phones: ['+1 202 555 0102'] });
  });

  it('writes just the header for an empty list', () => {
    expect(contactsToCsv([]).split('\r\n')[0]).toBe('Name,Email,Phone,Company,Title,URL,Notes,Connected On,Last Contacted,Industry,Sources');
  });
});
