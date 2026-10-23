import { describe, expect, it } from 'vitest';
import { parseFieldMap, parseText } from '../../src/lib/import';
import { fixture } from './helpers';

describe('Google Contacts CSV', () => {
  it('reads the current layout with every email and phone', () => {
    const { contacts, sourceHint } = parseText(fixture('google-contacts.csv'), 'google-csv');
    expect(sourceHint).toBe('google');
    expect(contacts).toHaveLength(2);
    const ada = contacts[0];
    expect(ada.name).toBe('Ada Lovelace');
    expect(ada.emails).toEqual(['ada@example.com', 'ada.home@example.com']);
    expect(ada.phones).toEqual(['+1 202-555-0101', '+1 202-555-0199']);
    expect(ada.org).toBe('Analytical Engines Ltd');
    expect(ada.title).toBe('Head of Engineering');
    expect(ada.notes).toBe('Met at the Babbage meetup.');
    expect(contacts[1].phones).toEqual(['(202) 555-0102']);
  });

  it('reads the older "Name,Given Name" layout', () => {
    const { contacts } = parseText(fixture('google-contacts-old.csv'), 'google-csv');
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      name: 'Ada Lovelace',
      emails: ['ada@example.com'],
      phones: ['+1 202-555-0101'],
      org: 'Analytical Engines Ltd',
      title: 'Head of Engineering',
    });
  });

  it('splits " ::: " multi-values', () => {
    const text = 'First Name,Last Name,E-mail 1 - Value,Phone 1 - Value\nA,B,a@example.com ::: b@example.com,+1 202 555 0101 ::: +1 202 555 0102\n';
    const { contacts } = parseText(text, 'google-csv');
    expect(contacts[0].emails).toEqual(['a@example.com', 'b@example.com']);
    expect(contacts[0].phones).toHaveLength(2);
  });
});

describe('Outlook CSV', () => {
  it('reads emails, phones, title, company and notes', () => {
    const { contacts, sourceHint } = parseText(fixture('outlook-contacts.csv'), 'outlook-csv');
    expect(sourceHint).toBe('outlook');
    const ada = contacts[0];
    expect(ada.name).toBe('Ada Lovelace');
    expect(ada.emails).toEqual(['ada@example.com', 'ada.home@example.com']);
    expect(ada.phones).toEqual(['+1 202-555-0101', '+1 202-555-0199']); // mobile before business
    expect(ada.title).toBe('Head of Engineering');
    expect(ada.org).toBe('Analytical Engines Ltd');
    expect(ada.notes).toBe('Met at the Babbage meetup.');
    expect(contacts[1]).toMatchObject({ name: 'Grace Hopper', org: 'US Navy', title: 'Rear Admiral' });
  });
});

describe('LinkedIn Connections.csv', () => {
  it('skips the Notes preamble, converts the date and keeps the profile URL', () => {
    const { contacts, warnings, sourceHint } = parseText(fixture('linkedin-Connections.csv'), 'linkedin-csv');
    expect(sourceHint).toBe('linkedin');
    expect(contacts).toHaveLength(2);
    expect(contacts[0]).toMatchObject({
      name: 'Ada Lovelace',
      emails: ['ada@example.com'],
      phones: [],
      org: 'Analytical Engines Ltd',
      title: 'Head of Engineering',
      urls: ['https://www.linkedin.com/in/ada-example'],
      connected_on: '2025-09-16',
    });
    expect(contacts[1].emails).toEqual([]);
    expect(contacts[1].connected_on).toBe('2024-01-02');
    expect(warnings[0]).toMatch(/1 of 2 connections have no email/);
  });
});

describe('generic CSV', () => {
  it('guesses columns from common header names', () => {
    const { contacts, warnings } = parseText(fixture('generic-crm.csv'), 'generic-csv');
    expect(contacts[0]).toMatchObject({
      name: 'Ada Lovelace',
      org: 'Analytical Engines Ltd',
      title: 'Head of Engineering',
      emails: ['ada@example.com', 'ada.home@example.com'],
      phones: ['+1 202-555-0101', '+1 202-555-0199'], // fax column ignored
      urls: ['https://example.com/ada'],
      connected_on: '2024-01-15',
      notes: 'Strong fit',
    });
    expect(warnings[0]).toMatch(/columns used: name ← Contact Name; email ← Email \+ Email 2/);
    expect(warnings[1]).toMatch(/columns ignored: Fax/);
  });

  it('reads the sample seed file (icp_reason becomes notes)', () => {
    const { contacts } = parseText(fixture('../../seed/sample-contacts.csv'), 'generic-csv');
    expect(contacts.length).toBeGreaterThan(10);
    expect(contacts[0]).toMatchObject({ name: 'Ada Lovelace', notes: 'Strong fit: technical buyer at a growing eng org' });
  });

  it('honours --map and complains about unknown columns or fields', () => {
    const text = 'Person,Mail,Cell\nAda Lovelace,ada@example.com,+1 202 555 0101\n';
    const map = parseFieldMap('full_name=Person,email=Mail');
    const { contacts } = parseText(text, 'generic-csv', { map });
    expect(contacts[0].emails).toEqual(['ada@example.com']);
    expect(contacts[0].phones).toEqual(['+1 202 555 0101']); // Cell still guessed
    expect(() => parseFieldMap('nickname=Person')).toThrow(/unknown field/);
    expect(() => parseText(text, 'generic-csv', { map: parseFieldMap('full_name=Nope') })).toThrow(/not found/);
  });

  it('reads numbered URL columns', () => {
    const { contacts } = parseText('Name,URL,URL 2\nAda,https://a.example,https://b.example\n', 'generic-csv');
    expect(contacts[0].urls).toEqual(['https://a.example', 'https://b.example']);
  });

  it('refuses a CSV with no recognisable name column', () => {
    expect(() => parseText('Foo,Bar\n1,2\n', 'generic-csv')).toThrow(/could not find a name column/);
  });
});

describe('Telegram export', () => {
  it('reads contacts.list with name, phone and date', () => {
    const { contacts, sourceHint } = parseText(fixture('telegram-result.json'), 'telegram-json');
    expect(sourceHint).toBe('telegram');
    expect(contacts).toEqual([
      { name: 'Ada Lovelace', emails: [], phones: ['+1 202 555 0101'], org: null, title: null, notes: null, urls: [], connected_on: '2024-01-15' },
      { name: 'Mary Shelley', emails: [], phones: ['+1 202 555 0104'], org: null, title: null, notes: null, urls: [], connected_on: '2024-02-01' },
    ]);
  });
});
