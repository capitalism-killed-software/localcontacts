import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb, getDb } from '../../src/lib/db';
import { createContact, getContact } from '../../src/lib/contacts';
import { listBackups, restoreBackup } from '../../src/lib/backups';
import { applyIndustries, classify, industryProposals } from '../../src/lib/industry';
import { applyNameFixes, nameFixCandidates } from '../../src/lib/cleanup/names';
import { applyDuplicates, bookDuplicates, findDuplicates } from '../../src/lib/cleanup/dupes';
import type { ExistingRow } from '../../src/lib/import/merge';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'localcontacts-cleanup-lib-'));
  process.env.CONTACTS_DB_PATH = join(dir, 'contacts.db');
  closeDb();
});
afterEach(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

const tag = (id: number, sources: string) => getDb().prepare('UPDATE contacts SET sources = ? WHERE id = ?').run(sources, id);

describe('industries', () => {
  it('classify follows the rule table, first match wins', () => {
    expect(classify('Riverside Dental Clinic', null)).toBe('Healthcare / Biotech');
    expect(classify('Northwind Bank', 'Teller')).toBe('Finance / Banking');
    expect(classify(null, null)).toBeNull();
    expect(classify('Mystery Ltd', 'Person')).toBeNull();
  });

  it('proposes industries for cards without one, and applies only the chosen ones, after a backup', () => {
    const a = createContact({ full_name: 'Ana', company: 'Riverside Dental Clinic' });
    const b = createContact({ full_name: 'Ben', company: 'Northwind Bank' });
    createContact({ full_name: 'Cy', company: 'Hillcrest School', industry: 'Mine already' });
    createContact({ full_name: 'Di', company: 'Mystery Ltd' });
    expect(industryProposals().map((p) => [p.id, p.industry])).toEqual([
      [a.id, 'Healthcare / Biotech'],
      [b.id, 'Finance / Banking'],
    ]);
    // Set by hand in the meantime: left alone.
    getDb().prepare("UPDATE contacts SET industry = 'Dentistry' WHERE id = ?").run(a.id);
    expect(applyIndustries([a.id, b.id, 9999]).changed).toBe(1);
    expect(getContact(a.id)!.industry).toBe('Dentistry');
    expect(getContact(b.id)!.industry).toBe('Finance / Banking');
    expect(listBackups()[0].record).toMatchObject({ reason: 'industries' });
    expect(applyIndustries([])).toEqual({ changed: 0, backup: null });
    expect(listBackups()).toHaveLength(1);
  });
});

describe('names', () => {
  it('lists the names it can tidy and applies only the chosen ones, after a backup', () => {
    const jo = createContact({ full_name: 'jo.baker@example.com', email: 'jo.baker@example.com' });
    const fred = createContact({ full_name: 'Fred Fish (fred@example.org)' });
    createContact({ full_name: 'Already Fine' });
    const c = nameFixCandidates();
    expect(c.map((x) => [x.id, x.from, x.to])).toEqual([
      [fred.id, 'Fred Fish (fred@example.org)', 'Fred Fish'],
      [jo.id, 'jo.baker@example.com', 'Jo Baker'],
    ]);
    expect(applyNameFixes([fred.id]).changed).toBe(1);
    expect(getContact(fred.id)).toMatchObject({ full_name: 'Fred Fish', email: 'fred@example.org' });
    expect(getContact(jo.id)!.full_name).toBe('jo.baker@example.com');
    expect(listBackups()[0].record).toMatchObject({ reason: 'names' });
  });
});

describe('findDuplicates', () => {
  const row = (id: number, over: Partial<ExistingRow>): ExistingRow => ({
    id, full_name: 'X', title: null, company: null, email: null, phone: null, alt_emails: null, alt_phones: null,
    urls: null, notes: null, connected_on: null, last_contacted: null, sources: null, ...over,
  });

  it('pairs cards that share an email, a phone (with names that fit) or a name, strongest reason first', () => {
    const rows = [
      row(1, { full_name: 'Ada Lovelace', email: 'ada@example.com' }),
      row(2, { full_name: 'Ada King', alt_emails: 'ADA@example.com' }),
      row(3, { full_name: 'Grace Hopper', phone: '+1 202 555 0101' }),
      row(4, { full_name: 'Grace B. Hopper', phone: '(202) 555-0101' }),
      row(5, { full_name: 'Mary Smith', phone: '+1 202 555 0199' }),
      row(6, { full_name: 'John Smith', phone: '+1 202 555 0199' }),
      row(7, { full_name: 'Sam Rivera', email: 'sam@one.example', phone: '+1 303 555 0111' }),
      row(8, { full_name: 'Sam Rivera', email: 'sam@two.example', phone: '+1 303 555 0122' }),
    ];
    const r = findDuplicates(rows, 'US');
    expect(r.pairs.map((p) => [p.a, p.b, p.reason])).toEqual([
      [1, 2, 'email'],
      [3, 4, 'phone'],
      [7, 8, 'name'],
    ]);
    expect(r.largeGroups).toEqual([]);
  });

  it('never pairs a made-up sample person with a real one, leaves dismissed pairs out, and only reports big groups', () => {
    const rows = [
      row(1, { full_name: 'Wei Chen', sources: 'sample' }),
      row(2, { full_name: 'Wei Chen', sources: 'google' }),
      row(3, { full_name: 'Sam Rivera', sources: 'sample' }),
      row(4, { full_name: 'Sam Rivera', sources: 'sample' }),
      row(5, { full_name: 'Kim Lee' }),
      row(6, { full_name: 'Kim Lee' }),
      ...Array.from({ length: 11 }, (_, i) => row(100 + i, { full_name: 'John Smith' })),
    ];
    const r = findDuplicates(rows, 'US', { dismissed: new Set(['5:6']) });
    expect(r.pairs.map((p) => [p.a, p.b])).toEqual([[3, 4]]);
    expect(r.largeGroups).toEqual([11]);
  });

  it('takes well under three seconds for 7,000 cards', () => {
    const first = ['Ada', 'Grace', 'Alan', 'Mary', 'Wei', 'Priya', 'Omar', 'Yuki', 'Ivan', 'Lena'];
    const last = ['Lovell', 'Hopkins', 'Turner', 'Chen', 'Raman', 'Okafor', 'Sato', 'Petrov', 'Meyer', 'Quinn'];
    const rows = Array.from({ length: 7000 }, (_, i) =>
      row(i + 1, {
        full_name: `${first[i % 10]} ${last[(i * 7) % 10]}${i % 50}`,
        email: `p${i % 6900}@example.com`,
        phone: `+1 202 555 ${String(i % 6950).padStart(4, '0')}`,
      })
    );
    const t = performance.now();
    const r = findDuplicates(rows, 'US');
    expect(performance.now() - t).toBeLessThan(3000);
    expect(r.pairs.length).toBeGreaterThan(0);
  });
});

describe('merging and dismissing in the book', () => {
  it('merges the chosen pairs losslessly in one backed-up write, following a kept card that is itself merged', () => {
    const a = createContact({ full_name: 'Ada Lovelace', email: 'ada@example.com' });
    const b = createContact({ full_name: 'Ada Lovelace', phone: '+1 202 555 0101' });
    const c = createContact({ full_name: 'Ada Lovelace', urls: 'https://ada.example' });
    const r = applyDuplicates({
      merges: [
        [b.id, c.id],
        [a.id, b.id],
      ],
    });
    expect(r).toMatchObject({ merged: 2, dismissed: 0 });
    expect(r.backup).toMatch(/contacts-\d{8}-\d{6}\.db$/);
    expect(getContact(b.id)).toBeNull();
    expect(getContact(c.id)).toBeNull();
    expect(getContact(a.id)).toMatchObject({ email: 'ada@example.com', phone: '+1 202 555 0101', urls: 'https://ada.example' });
    expect(listBackups()).toHaveLength(1);
    expect(listBackups()[0].record).toMatchObject({ reason: 'merge', cards: 3 });
  });

  it('skips pairs whose cards are gone or that would merge a card into itself', () => {
    const a = createContact({ full_name: 'Ada Lovelace' });
    const b = createContact({ full_name: 'Ada Lovelace' });
    expect(applyDuplicates({ merges: [[a.id, 999], [a.id, a.id], [b.id, a.id], [a.id, b.id]] })).toMatchObject({ merged: 1 });
    expect(getContact(a.id) === null).not.toBe(getContact(b.id) === null);
  });

  it('remembers "not the same person", and a restore puts that back as it was too', () => {
    const a = createContact({ full_name: 'Sam Rivera', email: 'one@example.com', phone: '+1 303 555 0111' });
    const b = createContact({ full_name: 'Sam Rivera', email: 'two@example.com', phone: '+1 303 555 0122' });
    tag(a.id, 'google');
    tag(b.id, 'google');
    expect(bookDuplicates().pairs).toHaveLength(1);
    expect(applyDuplicates({})).toEqual({ merged: 0, dismissed: 0, backup: null }); // nothing to do: no backup
    expect(applyDuplicates({ dismiss: [[b.id, a.id]] })).toMatchObject({ merged: 0, dismissed: 1 });
    expect(bookDuplicates().pairs).toHaveLength(0);
    // Undoing the Apply that dismissed it brings the pair back.
    const backup = listBackups()[0];
    expect(backup.record).toMatchObject({ reason: 'merge' });
    restoreBackup(backup.name);
    expect(bookDuplicates().pairs).toHaveLength(1);
  });
});
