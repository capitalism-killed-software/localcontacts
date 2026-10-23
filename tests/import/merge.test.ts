import { describe, expect, it } from 'vitest';
import { planMerge, recToColumns, type Batch, type ExistingRow, type IncomingContact } from '../../src/lib/import';

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
    const second = planMerge(existing, [batch('telegram', inc({ name: 'G H', phones: ['+12025550199'] }))], opts);
    expect(second.stats.inserted).toBe(0);
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
