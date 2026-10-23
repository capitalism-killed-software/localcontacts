import { describe, expect, it } from 'vitest';
import { parseText } from '../../src/lib/import';
import { fixture } from './helpers';

const vcf = (name: string) => parseText(fixture(name), 'vcard');

describe('vCard parser', () => {
  it('keeps every email and phone from a Google vCard 3.0, preferred first', () => {
    const { contacts, sourceHint } = vcf('google-contacts.vcf');
    expect(sourceHint).toBeNull();
    expect(contacts).toHaveLength(2);
    const ada = contacts[0];
    expect(ada.name).toBe('Ada Lovelace');
    expect(ada.emails).toEqual(['ada@example.com', 'ada.home@example.com']); // TYPE=PREF wins
    expect(ada.phones).toEqual(['+1 202-555-0101', '+1 202-555-0199']);
    expect(ada.org).toBe('Analytical Engines Ltd');
    expect(ada.title).toBe('Head of Engineering');
    expect(ada.notes).toBe('Met at the Babbage meetup.');
    expect(contacts[1].emails).toEqual(['grace@example.com']); // item1. group prefix stripped
  });

  it('reads an Apple iCloud export: groups, ORG department, escaped note, URL, skips photo and address', () => {
    const { contacts, warnings, sourceHint } = vcf('apple-contacts.vcf');
    expect(sourceHint).toBe('apple');
    const grace = contacts[0];
    expect(grace.name).toBe('Grace Brewster Hopper');
    expect(grace.emails).toEqual(['grace@example.com', 'grace.home@example.com']);
    expect(grace.phones).toEqual(['(202) 555-0102', '+1 (202) 555-0199']);
    expect(grace.org).toBe('US Navy');
    expect(grace.urls).toEqual(['https://example.com/grace']);
    expect(grace.notes).toBe('Coined "debugging", so they say.\nSecond paragraph.');
    expect(warnings.join(' ')).toMatch(/ADR ×1, BDAY ×1, PHOTO ×1/);
    // A company card with an empty N falls back to FN, then ORG.
    expect(contacts[1].name).toBe('Acme Plumbing');
    expect(contacts[1].phones).toEqual(['+1 202 555 0150']);
  });

  it('reads Proton vCard 4.0: PREF=n ordering and tel: URIs', () => {
    const { contacts, sourceHint } = vcf('proton-contacts.vcf');
    expect(sourceHint).toBe('proton');
    const ada = contacts[0];
    expect(ada.emails).toEqual(['ada@example.com', 'ada.home@example.com']); // PREF=1 before PREF=2
    expect(ada.phones).toEqual(['+12025550101', '+12025550199']);
    expect(contacts[1].name).toBe('Grace Hopper');
  });

  it('decodes vCard 2.1 quoted-printable names and notes with soft line breaks, and skips empty cards', () => {
    const { contacts, warnings } = vcf('android-v21.vcf');
    expect(contacts).toHaveLength(1);
    const renee = contacts[0];
    expect(renee.name).toBe('Renée Brontë');
    expect(renee.phones).toEqual(['+1 202 555 0103', '+1 202 555 0193']); // bare PREF param wins
    expect(renee.emails).toEqual(['renee@example.com']);
    expect(renee.notes).toBe('Café owner, second line');
    expect(warnings).toContain('1 empty card(s) skipped (no name, email or phone)');
  });

  it('builds the name from N when FN is missing', () => {
    const { contacts } = parseText('BEGIN:VCARD\nVERSION:3.0\nN:Curie;Marie;Salomea;Dr.;\nEMAIL:marie@example.com\nEND:VCARD\n', 'vcard');
    expect(contacts[0].name).toBe('Marie Salomea Curie');
  });

  it('uses "(no name)" for a card with only a phone', () => {
    const { contacts } = parseText('BEGIN:VCARD\nVERSION:3.0\nTEL:+1 202 555 0160\nEND:VCARD\n', 'vcard');
    expect(contacts[0].name).toBe('(no name)');
  });

  it('dedupes the same email in different case within a card', () => {
    const { contacts } = parseText(
      'BEGIN:VCARD\nFN:X\nEMAIL:A@example.com\nEMAIL;TYPE=PREF:a@example.com\nEND:VCARD\n',
      'vcard'
    );
    expect(contacts[0].emails).toEqual(['a@example.com']);
  });
});
