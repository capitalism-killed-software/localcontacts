import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb, getDb } from '../src/lib/db';
import { listBackups } from '../src/lib/backups';
import { runImport } from '../src/lib/import/run';
import { isTag, tagProblem } from '../src/lib/import/tags';
import { loadSamplePeople, removeSamplePeople, sampleCount, SAMPLE_TAG } from '../src/lib/sample';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'localcontacts-sample-'));
  process.env.CONTACTS_DB_PATH = join(dir, 'contacts.db');
  closeDb();
});
afterEach(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

const cards = () =>
  getDb().prepare('SELECT full_name, email, phone, company, sources FROM contacts ORDER BY id').all() as Array<{
    full_name: string; email: string | null; phone: string | null; company: string | null; sources: string;
  }>;
const csv = (text: string) => ({ name: 'mine.csv', bytes: Buffer.from(text) });

describe('sample people', () => {
  it('load into an empty book as 15 made-up cards, the two Sam Riveras kept apart', () => {
    const r = loadSamplePeople();
    expect(r.written).toEqual({ inserted: 15, updated: 0 });
    expect(sampleCount()).toBe(15);
    expect(cards().every((c) => c.sources === SAMPLE_TAG)).toBe(true);
    expect(cards().filter((c) => c.full_name === 'Sam Rivera')).toHaveLength(2);
    expect(listBackups()).toHaveLength(0); // nothing to lose in an empty book
  });

  it('never take in a real contact who shares a name with one of them', () => {
    loadSamplePeople();
    // Rose Whitfield (sample) has only a phone; a real Rose with only an email would have merged by name.
    runImport([csv('Name,Email,Company\nRose Whitfield,rose@realmail.example,Real Co\n')], { apply: true, backup: false });
    const roses = cards().filter((c) => c.full_name === 'Rose Whitfield');
    expect(roses).toHaveLength(2);
    expect(roses.find((c) => c.sources === SAMPLE_TAG)).toMatchObject({ email: null, company: null });
    expect(roses.find((c) => c.sources === 'csv')).toMatchObject({ email: 'rose@realmail.example', company: 'Real Co' });
  });

  it('can be removed as part of an import, in the same backed-up write', () => {
    loadSamplePeople();
    const dry = runImport([csv('Name,Email\nReal Person,real@realmail.example\n')], { removeSample: true });
    expect(dry.after).toBe(1);
    const r = runImport([csv('Name,Email\nReal Person,real@realmail.example\n')], { apply: true, removeSample: true });
    expect(r.after).toBe(1);
    expect(cards().map((c) => c.full_name)).toEqual(['Real Person']);
    expect(listBackups()[0].record).toMatchObject({ reason: 'import', cards: 15 });
  });

  it('can be removed on their own; cards that are also real stay', () => {
    loadSamplePeople();
    getDb().prepare("UPDATE contacts SET sources = 'sample,linkedin' WHERE full_name = 'Priya Nair'").run();
    expect(removeSamplePeople()).toBe(14);
    expect(cards().map((c) => c.full_name)).toEqual(['Priya Nair']);
    expect(listBackups()[0].record).toMatchObject({ reason: 'sample', cards: 15 });
    expect(removeSamplePeople()).toBe(0);
  });

  it('keep their tag to themselves: a person cannot type it, but our own exports still read it back', () => {
    expect(tagProblem('sample', { typed: true })).toMatch(/kept for the made-up sample people/);
    expect(tagProblem('Sample', { typed: true })).toMatch(/kept for/);
    expect(tagProblem('sample')).toBeNull();
    expect(isTag('sample')).toBe(true);
  });

  it('ship in every install form, with the export guide', () => {
    const ignored = readFileSync('.dockerignore', 'utf-8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    expect(ignored.some((l) => /^(\/)?seed(\/|$)|^\*\.vcf$/.test(l))).toBe(false);
    expect(ignored).toContain('!docs/exporting-your-contacts.md');
  });
});
