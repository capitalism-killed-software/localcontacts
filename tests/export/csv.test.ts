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
    expect(header).toBe('ID,Name,Email,Email 2,Phone,Company,Title,URL,URL 2,Notes,Connected On,Last Contacted,Industry,Sources');
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
      industry: 'Software / Technology',
      sources: ['google', 'linkedin'],
    });
    // A card without a name comes back without one, its company still its company.
    expect(back[1]).toMatchObject({ name: '(no name)', org: 'Acme', phones: ['+1 202 555 0102'] });
  });

  it('writes just the header for an empty list', () => {
    expect(contactsToCsv([]).split('\r\n')[0]).toBe('ID,Name,Email,Phone,Company,Title,URL,Notes,Connected On,Last Contacted,Industry,Sources');
  });
});

describe('Excel-safe CSV', () => {
  const tricky = c({
    full_name: '=HYPERLINK("http://x.example","click")',
    phone: '+1 202 555 0101',
    company: '-Minus Co',
    title: '@handle',
    notes: "'=already quoted",
    urls: "'plain apostrophe",
    sources: 'google',
  });

  it('puts a quote before every cell a spreadsheet would run, and our importer takes it off again', () => {
    const text = contactsToCsv([tricky], { excel: true });
    const row = text.split('\r\n')[1];
    expect(row).toContain(`"'=HYPERLINK(""http://x.example"",""click"")"`);
    expect(row).toContain(",'+1 202 555 0101,");
    expect(row).toContain(",'-Minus Co,");
    expect(row).toContain(",'@handle,");
    expect(row).toContain(",''=already quoted,");
    expect(row).toContain(",'plain apostrophe,");
    const back = parseText(text, 'generic-csv').contacts[0];
    expect(back).toMatchObject({
      name: tricky.full_name,
      phones: ['+1 202 555 0101'],
      org: '-Minus Co',
      title: '@handle',
      notes: "'=already quoted",
      urls: ["'plain apostrophe"],
    });
  });

  it('without it, writes values as they are (a quote is added only where one already leads a formula sign)', () => {
    const text = contactsToCsv([tricky]);
    const row = text.split('\r\n')[1];
    expect(row).toContain(',"=HYPERLINK(');
    expect(row).toContain(',+1 202 555 0101,');
    expect(row).toContain(",''=already quoted,");
    expect(parseText(text, 'generic-csv').contacts[0]).toMatchObject({ name: tricky.full_name, notes: "'=already quoted", phones: ['+1 202 555 0101'] });
  });

  it("leaves quotes alone in someone else's CSV", () => {
    const back = parseText("Name,Email\n'=Not ours,x@example.com\n", 'generic-csv').contacts[0];
    expect(back.name).toBe("'=Not ours");
  });
});

