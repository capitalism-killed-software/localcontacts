import { describe, expect, it } from 'vitest';
import { planMerge, recToColumns, type Batch, type ExistingRow, type IncomingContact } from '../../src/lib/import';
import { namesCompatible } from '../../src/lib/import/merge';

const row = (over: Partial<ExistingRow>): ExistingRow => ({
  id: 1, full_name: 'X', title: null, company: null, email: null, phone: null,
  alt_emails: null, alt_phones: null, urls: null, notes: null, connected_on: null,
  last_contacted: null, sources: null, ...over,
});
const inc = (over: Partial<IncomingContact>): IncomingContact => ({
  name: 'X', emails: [], phones: [], org: null, title: null, notes: null, urls: [], connected_on: null, ...over,
});
const batch = (source: string, ...contacts: IncomingContact[]): Batch => ({ source, contacts });
const opts = { country: 'US' as const };

describe('planMerge', () => {
  it('matches on email regardless of case and fills the gaps', () => {
    const existing = [row({ id: 7, full_name: 'Ada Lovelace', email: 'ada@example.com', sources: 'linkedin' })];
    const { rows, stats } = planMerge(existing, [batch('google', inc({
      name: 'Ada Lovelace', emails: ['ADA@EXAMPLE.COM', 'ada.home@example.com'],
      phones: ['+1 202-555-0101'], org: 'Analytical Engines Ltd', notes: 'Met at the meetup.',
    }))], opts);
    expect(stats).toMatchObject({ incoming: 1, inserted: 0, mergedIntoExisting: 1, addedEmails: 1, addedPhones: 1, filledPhone: 1, filledEmail: 0 });
    expect(rows).toHaveLength(1);
    const cols = recToColumns(rows[0]);
    expect(rows[0].dirty).toBe(true);
    expect(cols).toMatchObject({
      email: 'ada@example.com', alt_emails: 'ada.home@example.com', phone: '+1 202-555-0101',
      company: 'Analytical Engines Ltd', notes: 'Met at the meetup.', sources: 'google,linkedin',
    });
  });

  it('matches on phone across formats when names differ', () => {
    const existing = [row({ id: 3, full_name: 'Ada Lovelace', phone: '(202) 555-0101' })];
    const { rows, stats } = planMerge(existing, [batch('telegram', inc({ name: 'Ada L', phones: ['+12025550101'] }))], opts);
    expect(stats.inserted).toBe(0);
    expect(stats.mergedIntoExisting).toBe(1);
    expect(recToColumns(rows[0])).toMatchObject({ phone: '(202) 555-0101', alt_phones: null, sources: 'telegram' });
  });

  it('does not merge on a shared phone when the emails disagree', () => {
    const existing = [row({ id: 4, full_name: 'Grace Hopper', email: 'grace@example.com', phone: '+1 202 555 0199' })];
    const { rows, stats } = planMerge(existing, [batch('vcard', inc({ name: 'Ada Lovelace', emails: ['ada@example.com'], phones: ['(202) 555-0199'] }))], opts);
    expect(stats.inserted).toBe(1);
    expect(rows).toHaveLength(2);
    // Without an email on one side, the phone still matches.
    const second = planMerge(existing, [batch('telegram', inc({ name: 'Grace', phones: ['+12025550199'] }))], opts);
    expect(second.stats.inserted).toBe(0);
  });

  it('needs compatible names to merge on a shared phone', () => {
    const existing = [row({ id: 1, full_name: 'Mary Smith', phone: '+1 202 555 0100' })];
    const family = planMerge(existing, [batch('apple', inc({ name: 'John Smith', phones: ['(202) 555-0100'] }))], opts);
    expect(family.stats.inserted).toBe(1);
    const reception = planMerge(existing, [batch('csv', inc({ name: 'Reception', phones: ['+12025550100'] }))], opts);
    expect(reception.stats.inserted).toBe(1);
    const nickname = planMerge(existing, [batch('telegram', inc({ name: 'Mary S', phones: ['+12025550100'] }))], opts);
    expect(nickname.stats.inserted).toBe(0);
    const unnamed = planMerge(existing, [batch('vcard', inc({ name: '(no name)', phones: ['+12025550100'] }))], opts);
    expect(unnamed.stats.inserted).toBe(0);
  });

  it('keeps cards from one file apart when their ids differ, unless an email matches', () => {
    const twins = planMerge([], [batch('vcard',
      inc({ name: 'Belle Example', uid: 'a' }),
      inc({ name: 'Belle Example', uid: 'b' }),
      inc({ name: 'Pat Line', phones: ['+1 202 555 0123'], uid: 'c' }),
      inc({ name: 'Pat Line', phones: ['+1 202 555 0123'], uid: 'd' }),
    )], opts);
    expect(twins.rows).toHaveLength(4);
    const sameEmail = planMerge([], [batch('vcard',
      inc({ name: 'Ada', emails: ['ada@example.com'], uid: 'a' }),
      inc({ name: 'Ada L', emails: ['ada@example.com'], uid: 'b' }),
    )], opts);
    expect(sameEmail.rows).toHaveLength(1);
    // Across files the ids mean nothing to each other, so names still merge.
    const acrossFiles = planMerge([], [batch('one', inc({ name: 'Belle Example', uid: 'a' })), batch('two', inc({ name: 'Belle Example', uid: 'b' }))], opts);
    expect(acrossFiles.rows).toHaveLength(1);
  });

  it('falls back to the normalised name', () => {
    const existing = [row({ id: 2, full_name: 'Grace Hopper' })];
    const { stats, rows } = planMerge(existing, [batch('csv', inc({ name: 'grace hopper', emails: ['grace@example.com'] }))], opts);
    expect(stats.inserted).toBe(0);
    expect(stats.filledEmail).toBe(1);
    expect(recToColumns(rows[0]).email).toBe('grace@example.com');
  });

  it('merges duplicates within the same run and across files', () => {
    const { rows, stats } = planMerge([], [
      batch('google', inc({ name: 'Ada Lovelace', emails: ['ada@example.com'] })),
      batch('proton', inc({ name: 'A. Lovelace', emails: ['ada@example.com'], phones: ['+1 202 555 0101'] })),
    ], opts);
    expect(rows).toHaveLength(1);
    expect(stats).toMatchObject({ inserted: 1, mergedWithinImport: 1, mergedIntoExisting: 0 });
    expect(recToColumns(rows[0]).sources).toBe('google,proton');
  });

  it('never merges nameless cards with each other', () => {
    const { rows } = planMerge([], [batch('vcard',
      inc({ name: '(no name)', phones: ['+1 202 555 0111'] }),
      inc({ name: '(no name)', phones: ['+1 202 555 0112'] }),
    )], opts);
    expect(rows).toHaveLength(2);
  });

  it('replaces a placeholder name with a real one', () => {
    const existing = [row({ id: 5, full_name: 'sam.ortega@example.com', email: 'sam.ortega@example.com' })];
    const { rows } = planMerge(existing, [batch('google', inc({ name: 'Sam Ortega', emails: ['sam.ortega@example.com'] }))], opts);
    expect(rows[0].full_name).toBe('Sam Ortega');
  });

  it('never overwrites a stored value and appends distinct notes', () => {
    const existing = [row({ id: 9, full_name: 'Ada', email: 'ada@example.com', company: 'Old Co', notes: 'first' })];
    const { rows } = planMerge(existing, [batch('x', inc({ name: 'Ada', emails: ['ada@example.com'], org: 'New Co', notes: 'second' }))], opts);
    expect(rows[0].company).toBe('Old Co');
    expect(rows[0].notes).toBe('first\nsecond');
  });

  it('is a no-op when re-run with the same data', () => {
    const first = planMerge([], [batch('google', inc({ name: 'Ada', emails: ['ada@example.com'], phones: ['+1 202 555 0101'] }))], opts);
    const asRows = first.rows.map((r, i) => ({ id: i + 1, ...recToColumns(r) }));
    const second = planMerge(asRows, [batch('google', inc({ name: 'Ada', emails: ['ada@example.com'], phones: ['+1 202 555 0101'] }))], opts);
    expect(second.stats).toMatchObject({ inserted: 0, mergedIntoExisting: 0 });
    expect(second.rows[0].dirty).toBe(false);
  });

  it('tag-only adds the tag to matches and inserts nothing', () => {
    const existing = [row({ id: 1, full_name: 'Ada', email: 'ada@example.com', phone: null, sources: 'linkedin' })];
    const { rows, stats } = planMerge(existing, [batch('google',
      inc({ name: 'Ada', emails: ['ada@example.com'], phones: ['+1 202 555 0101'] }),
      inc({ name: 'Nobody Known', emails: ['nobody@example.com'] }),
    )], { ...opts, tagOnly: true });
    expect(rows).toHaveLength(1);
    expect(stats.skippedUnmatched).toBe(1);
    const cols = recToColumns(rows[0]);
    expect(cols.sources).toBe('google,linkedin');
    expect(cols.phone).toBeNull(); // tag-only changes nothing else
  });
});


describe('namesCompatible', () => {
  it('accepts the same person written differently and rejects different people', () => {
    expect(namesCompatible('Ada Lovelace', 'ada lovelace')).toBe(true);
    expect(namesCompatible('Ada L', 'Ada Lovelace')).toBe(true);
    expect(namesCompatible('Lovelace', 'Ada Lovelace')).toBe(true);
    expect(namesCompatible('(no name)', 'Ada Lovelace')).toBe(true);
    expect(namesCompatible('ada@example.com', 'Ada Lovelace')).toBe(true);
    expect(namesCompatible('Mary Smith', 'John Smith')).toBe(false);
    expect(namesCompatible('Reception', 'Jane Doe')).toBe(false);
  });
});
