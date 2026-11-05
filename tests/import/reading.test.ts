import { describe, expect, it } from 'vitest';
import { decodeFile, detect, parseText } from '../../src/lib/import';
import { runImport } from '../../src/lib/import/run';

// How files are read before they are parsed: columns, separators, encodings, folding.

const csv = (text: string) => parseText(text, detect(text) as 'generic-csv');

describe('CSV columns', () => {
  it('reads every header column even when the first row leaves trailing cells out', () => {
    const r = csv('Name,Email,Phone,Company,Notes\r\nA One,a1@example.com\r\nB Two,b2@example.com,+1 202 555 0152,Co B,note b\r\n');
    expect(r.contacts[1]).toMatchObject({ name: 'B Two', phones: ['+1 202 555 0152'], org: 'Co B', notes: 'note b' });
    expect(r.warnings[0]).toMatch(/phone ← Phone.*company ← Company.*note ← Notes/);
  });

  it('keeps both columns when a header name is repeated', () => {
    const r = csv('Name,Email,Email,Phone,Phone\nAda,first@example.com,second@example.com,+1 202 555 0144,+1 202 555 0145\n');
    expect(r.contacts[0].emails).toEqual(['first@example.com', 'second@example.com']);
    expect(r.contacts[0].phones).toEqual(['+1 202 555 0144', '+1 202 555 0145']);
  });

  it('reads semicolon-separated (European Excel) and tab-separated files', () => {
    const semi = 'Name;Email;Company\r\nJürgen Müller;jm@example.com;Müller, Söhne & Co\r\n';
    expect(detect(semi)).toBe('generic-csv');
    expect(csv(semi).contacts[0]).toMatchObject({ name: 'Jürgen Müller', emails: ['jm@example.com'], org: 'Müller, Söhne & Co' });
    const tsv = 'Name\tEmail\nAda Lovelace\tada@example.com\n';
    expect(csv(tsv).contacts[0]).toMatchObject({ name: 'Ada Lovelace', emails: ['ada@example.com'] });
  });
});

describe('encodings', () => {
  const cp1252 = (s: string) => Buffer.from([...s].map((c) => ({ 'ü': 0xfc, 'é': 0xe9, 'ç': 0xe7, '“': 0x93, '”': 0x94 } as Record<string, number>)[c] ?? c.charCodeAt(0)));

  it('reads a Windows-1252 file instead of turning accents into �, and says so', () => {
    const { text, note } = decodeFile(cp1252('Name,Company\r\nJürgen Müller,Café “Ltd”\r\n'));
    expect(text).toBe('Name,Company\r\nJürgen Müller,Café “Ltd”\r\n');
    expect(note).toMatch(/Windows-1252/);
    expect(decodeFile(Buffer.from('Name\nJürgen\n', 'utf-8'))).toEqual({ text: 'Name\nJürgen\n', note: null });
  });

  it('uses a vCard line’s CHARSET and keeps UTF-8 lines as they are', () => {
    const bytes = Buffer.concat([
      Buffer.from('BEGIN:VCARD\r\nVERSION:2.1\r\nN;CHARSET=ISO-8859-1:'), cp1252('Müller;Jürgen'),
      Buffer.from('\r\nNOTE:Zoë 李\r\nEND:VCARD\r\n', 'utf-8'),
    ]);
    const r = parseText(decodeFile(bytes).text, 'vcard');
    expect(r.contacts[0]).toMatchObject({ name: 'Jürgen Müller', notes: 'Zoë 李' });
  });

  it('decodes quoted-printable without a CHARSET as UTF-8, or else Windows-1252', () => {
    const v = (qp: string) => `BEGIN:VCARD\r\nVERSION:2.1\r\nFN;ENCODING=QUOTED-PRINTABLE:${qp}\r\nEND:VCARD\r\n`;
    expect(parseText(v('J=C3=BCrgen'), 'vcard').contacts[0].name).toBe('Jürgen');
    expect(parseText(v('J=FCrgen'), 'vcard').contacts[0].name).toBe('Jürgen');
  });

  it('puts a character back together when a folded line splits its bytes', () => {
    const bytes = Buffer.concat([
      Buffer.from('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Zo'), Buffer.from([0xc3]), Buffer.from('\r\n '), Buffer.from([0xab]),
      Buffer.from(' Li '), Buffer.from([0xe6, 0x9d]), Buffer.from('\r\n '), Buffer.from([0x8e]), Buffer.from('\r\nEND:VCARD\r\n'),
    ]);
    expect(decodeFile(bytes).note).toBeNull();
    expect(parseText(decodeFile(bytes).text, 'vcard').contacts[0].name).toBe('Zoë Li 李');
  });

  it('reports the encoding note on the file in an import', () => {
    const report = runImport([{ name: 'excel.csv', bytes: cp1252('Name,Email\r\nJürgen Müller,jm@example.com\r\n') }]);
    expect(report.files[0].warnings[0]).toMatch(/Windows-1252/);
  });
});
