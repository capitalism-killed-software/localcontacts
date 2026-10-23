import { describe, expect, it } from 'vitest';
import { detect, decodeFileBytes, unknownHint } from '../../src/lib/import';
import { fixture } from './helpers';

describe('detect', () => {
  it.each([
    ['google-contacts.vcf', 'vcard'],
    ['apple-contacts.vcf', 'vcard'],
    ['proton-contacts.vcf', 'vcard'],
    ['android-v21.vcf', 'vcard'],
    ['google-contacts.csv', 'google-csv'],
    ['google-contacts-old.csv', 'google-csv'],
    ['outlook-contacts.csv', 'outlook-csv'],
    ['linkedin-Connections.csv', 'linkedin-csv'],
    ['telegram-result.json', 'telegram-json'],
    ['generic-crm.csv', 'generic-csv'],
    ['sample-contacts.csv', 'generic-csv'],
    ['not-contacts.txt', 'unknown'],
    ['not-telegram.json', 'unknown'],
  ])('%s is %s', (file, format) => {
    const text = file === 'sample-contacts.csv' ? fixture('../../seed/sample-contacts.csv') : fixture(file);
    expect(detect(text)).toBe(format);
  });

  it('does not mistake prose or a one-column list for a CSV', () => {
    expect(detect('Dear diary,\ntoday I exported nothing.\n')).toBe('unknown');
    expect(detect('name\nAda\nGrace\n')).toBe('unknown');
    expect(detect('Name,Email\nAda,ada@example.com\n')).toBe('generic-csv');
    expect(detect('Name,Email\n')).toBe('generic-csv');
  });

  it('reads a CSV whose first data row has a multi-line quoted cell', () => {
    expect(detect('Name,Notes\n"Ada Lovelace","line one\nline two"\nGrace,x\n')).toBe('generic-csv');
  });

  it('ignores a UTF-8 byte-order mark', () => {
    expect(detect('﻿BEGIN:VCARD\nEND:VCARD')).toBe('vcard');
  });

  it('decodes UTF-16 files with a byte-order mark', () => {
    const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Name,Given Name,Family Name\n', 'utf16le')]);
    expect(decodeFileBytes(le)).toBe('Name,Given Name,Family Name\n');
    const be = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('abc', 'utf16le').swap16()]);
    expect(decodeFileBytes(be)).toBe('abc');
    expect(decodeFileBytes(Buffer.from('﻿plain', 'utf-8'))).toBe('plain');
  });

  it('explains why a file was not recognised', () => {
    expect(unknownHint(fixture('not-telegram.json'), 'x.json')).toMatch(/Telegram/);
    expect(unknownHint('a,b', 'contacts.xlsx')).toMatch(/CSV/);
    expect(unknownHint(fixture('not-contacts.txt'), 'chat.txt')).toMatch(/address book/);
  });
});
