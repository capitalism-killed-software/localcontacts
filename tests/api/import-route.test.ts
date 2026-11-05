import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  it('removes the sample people in the same write when asked', async () => {
    const { loadSamplePeople, sampleCount } = await import('../../src/lib/sample');
    loadSamplePeople();
    const dry = (await (await upload(['apple-contacts.vcf'], { removeSample: '1' })).json()) as ImportReport;
    expect(dry.after).toBe(2);
    expect(sampleCount()).toBe(15);
    await upload(['apple-contacts.vcf'], { apply: '1', removeSample: '1' });
    expect(sampleCount()).toBe(0);
    expect(countContacts()).toBe(2);
  });

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
    expect(readdirSync(join(dir, 'backups')).filter((f) => f.endsWith('.db')).length).toBe(2);
    expect(listContacts().find((c) => c.full_name === 'Ada Lovelace')!.sources).toBe('linkedin,phone');
  });

  it('refuses everything when one file is unreadable', async () => {
    const r = (await (await upload(['google-contacts.vcf', 'not-contacts.txt'], { apply: '1' })).json()) as ImportReport;
    expect(r.ok).toBe(false);
    expect(r.files[1]).toMatchObject({ name: 'not-contacts.txt', ok: false });
    expect(r.files[1].error).toMatch(/not a contact export/);
    expect(countContacts()).toBe(0);
  });

  it('reports the columns of a CSV and takes column choices', async () => {
    const first = (await (await upload(['unguessable.csv'])).json()) as ImportReport;
    expect(first.ok).toBe(false);
    expect(first.files[0].headers).toEqual(['Who', 'Mail', 'Cell', 'Org']);
    expect(first.files[0].error).toMatch(/could not find a name column/);

    const mapped = (await (
      await upload(['unguessable.csv'], { 'map:0': JSON.stringify({ full_name: 'Who', email: 'Mail', company: 'Org', bogus: 'x' }) })
    ).json()) as ImportReport;
    expect(mapped.ok).toBe(true);
    expect(mapped.files[0].count).toBe(2);
    await upload(['unguessable.csv'], { 'map:0': JSON.stringify({ full_name: 'Who', email: 'Mail', company: 'Org' }), apply: '1' });
    expect(listContacts().find((c) => c.full_name === 'Otto Unguessed')).toMatchObject({ email: 'otto@example.com', company: 'Mapping Ltd' });

    expect((await upload(['unguessable.csv'], { 'map:0': '{not json' })).status).toBe(400);
  });

  it('rejects other websites, empty uploads and bad tags', async () => {
    expect((await upload(['google-contacts.vcf'], { apply: '1' }, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await upload(['google-contacts.vcf'], {}, { origin: '' , 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect(countContacts()).toBe(0);
    expect((await upload([])).status).toBe(400);
    expect((await upload(['google-contacts.vcf'], { source: 'bad tag!' })).status).toBe(400);
  });
});

describe('POST /api/import refusals', () => {
  it('refuses another site even when it claims a forwarded host', async () => {
    const res = await upload(['google-contacts.vcf'], { apply: '1' }, { origin: 'http://evil.example', 'x-forwarded-host': 'evil.example' });
    expect(res.status).toBe(403);
    expect(countContacts()).toBe(0);
  });

  it('names the real problem with a tag or an empty file', async () => {
    const long = await upload(['google-contacts.vcf'], { source: 'a'.repeat(41) });
    expect(long.status).toBe(400);
    expect((await long.json()).error).toBe('A source tag can be at most 40 characters long.');
    const form = new FormData();
    form.append('file', new File([], 'empty.vcf'));
    const res = await POST(new Request('http://localhost:3000/api/import', { method: 'POST', body: form, headers: { host: 'localhost:3000', origin: 'http://localhost:3000' } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('empty.vcf is empty.');
  });
});

describe('backups', () => {
  it('are named in local time, and a second one in the same second sorts after the first', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 4, 18, 8, 0));
    try {
      await upload(['google-contacts.vcf'], { apply: '1' });
      await upload(['linkedin-Connections.csv'], { apply: '1' });
      const names = readdirSync(join(dir, 'backups')).filter((f) => f.endsWith('.db'));
      expect(names.sort()).toEqual(['contacts-20261104-180800.db', 'contacts-20261104-180800b.db']);
    } finally {
      vi.useRealTimers();
    }
  });
});
