import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb } from '../../src/lib/db';
import { countContacts, listContacts } from '../../src/lib/contacts';
import { POST } from '../../src/app/api/import/route';
import type { ImportReport } from '../../src/lib/import/run';

const FIX = (n: string) => join(process.cwd(), 'tests', 'fixtures', n);

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'localcontacts-import-route-'));
  process.env.CONTACTS_DB_PATH = join(dir, 'contacts.db');
  closeDb();
});
afterEach(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

function upload(files: string[], extra: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const form = new FormData();
  for (const f of files) form.append('file', new File([readFileSync(FIX(f))], f));
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return POST(
    new Request('http://localhost:3000/api/import', {
      method: 'POST',
      body: form,
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000', ...headers },
    })
  );
}

describe('POST /api/import', () => {
  it('dry-runs by default and writes nothing', async () => {
    const res = await upload(['google-contacts.vcf', 'linkedin-Connections.csv']);
    expect(res.status).toBe(200);
    const r = (await res.json()) as ImportReport;
    expect(r.ok).toBe(true);
    expect(r.applied).toBe(false);
    expect(r.files.map((f) => [f.name, f.label, f.count])).toEqual([
      ['google-contacts.vcf', 'vCard', 2],
      ['linkedin-Connections.csv', 'LinkedIn Connections.csv', 2],
    ]);
    expect(r.stats!.inserted).toBe(3);
    expect(countContacts()).toBe(0);
  });

  it('imports with apply, backs up first, and tags with the given source', async () => {
    await upload(['linkedin-Connections.csv'], { apply: '1' });
    expect(countContacts()).toBe(2);
    const res = await upload(['google-contacts.vcf'], { apply: '1', source: 'phone' });
    const r = (await res.json()) as ImportReport;
    expect(r.applied).toBe(true);
    expect(r.written).toEqual({ inserted: 1, updated: 1 });
    expect(r.backup && existsSync(r.backup)).toBe(true);
    expect(readdirSync(join(dir, 'backups')).length).toBe(2);
    expect(listContacts().find((c) => c.full_name === 'Ada Lovelace')!.sources).toBe('linkedin,phone');
  });

  it('refuses everything when one file is unreadable', async () => {
    const r = (await (await upload(['google-contacts.vcf', 'not-contacts.txt'], { apply: '1' })).json()) as ImportReport;
    expect(r.ok).toBe(false);
    expect(r.files[1]).toMatchObject({ name: 'not-contacts.txt', ok: false });
    expect(r.files[1].error).toMatch(/not a contact export/);
    expect(countContacts()).toBe(0);
  });

  it('rejects other websites, empty uploads and bad tags', async () => {
    expect((await upload(['google-contacts.vcf'], { apply: '1' }, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await upload(['google-contacts.vcf'], {}, { origin: '' , 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect(countContacts()).toBe(0);
    expect((await upload([])).status).toBe(400);
    expect((await upload(['google-contacts.vcf'], { source: 'bad tag!' })).status).toBe(400);
  });
});
