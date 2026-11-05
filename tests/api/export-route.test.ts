import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb, getDb } from '../../src/lib/db';
import { createContact } from '../../src/lib/contacts';
import { GET } from '../../src/app/api/export/route';
import { GET as getCard } from '../../src/app/api/vcard/[id]/route';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'localcontacts-export-route-'));
  process.env.CONTACTS_DB_PATH = join(dir, 'contacts.db');
  closeDb();
  createContact({ full_name: 'Ada Lovelace', email: 'ada@example.com', phone: '+1 202 555 0101' });
  createContact({ full_name: 'Grace Hopper', email: 'grace@example.com' });
  createContact({ full_name: 'Alan Turing', phone: '+44 20 7946 0000' });
  getDb().exec("UPDATE contacts SET sources = CASE WHEN full_name LIKE 'Ada%' THEN 'google' ELSE 'linkedin' END");
});
afterEach(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

const get = (qs: string, headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) =>
  GET(new Request(`http://localhost:3000/api/export?${qs}`, { headers: { host: 'localhost:3000', ...headers } }));

describe('GET /api/export', () => {
  it('sends the book as an Excel-safe CSV with a BOM, as a download', async () => {
    const res = await get('format=csv');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="contacts-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain(",'+1 202 555 0101,");
    expect(text.trim().split('\r\n')).toHaveLength(4);
  });

  it('exports what the book shows: a group, a search, in its order', async () => {
    const res = await get('format=vcard&source=linkedin');
    expect(res.headers.get('content-type')).toBe('text/vcard; charset=utf-8');
    expect(res.headers.get('content-disposition')).toMatch(/filename="contacts-linkedin-\d{4}-\d{2}-\d{2}\.vcf"/);
    const text = await res.text();
    expect(text.match(/BEGIN:VCARD/g)).toHaveLength(2);
    expect(text.indexOf('Grace Hopper')).toBeLessThan(text.indexOf('Alan Turing'));
    expect(text).not.toContain('Ada Lovelace');
    const q = await (await get('format=csv&q=ada')).text();
    expect(q).toContain('Ada Lovelace');
    expect(q).not.toContain('Grace Hopper');
  });

  it('refuses an unknown format', async () => {
    expect((await get('format=pdf')).status).toBe(400);
    expect((await get('')).status).toBe(400);
  });

  it('refuses other sites, including other apps on this computer, but not a typed address or a script', async () => {
    expect((await get('format=csv', { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await get('format=csv', { 'sec-fetch-site': 'same-site' })).status).toBe(403);
    expect((await get('format=csv', { 'sec-fetch-site': 'none' })).status).toBe(200);
    expect((await get('format=csv', {})).status).toBe(200);
    const card = (h: Record<string, string>) =>
      getCard(new Request('http://localhost:3000/api/vcard/1', { headers: { host: 'localhost:3000', ...h } }), { params: Promise.resolve({ id: '1' }) });
    expect((await card({ 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await card({ 'sec-fetch-site': 'same-origin' })).status).toBe(200);
  });
});
