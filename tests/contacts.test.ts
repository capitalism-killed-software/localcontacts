import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDb } from '../src/lib/db';
import {
  createContact,
  getContact,
  listContacts,
  updateContact,
  deleteContact,
  countContacts,
} from '../src/lib/contacts';

// Use an isolated in-memory DB. db.ts reads CONTACTS_DB_PATH lazily on first
// open, so setting it before the first getDb() call (via closeDb in beforeEach)
// is enough — each test gets a fresh, empty schema.
beforeAll(() => {
  process.env.CONTACTS_DB_PATH = ':memory:';
});

beforeEach(() => {
  closeDb();
});

describe('createContact / getContact', () => {
  it('round-trips a contact and assigns an id + timestamps', () => {
    const c = createContact({ full_name: 'Ada Lovelace', email: 'ada@example.com' });
    expect(c.id).toBeGreaterThan(0);
    expect(c.full_name).toBe('Ada Lovelace');
    expect(c.email).toBe('ada@example.com');
    expect(c.created_at).toBeTruthy();
    expect(c.updated_at).toBeTruthy();

    const fetched = getContact(c.id);
    expect(fetched).toEqual(c);
  });

  it('trims full_name and converts blank fields to null', () => {
    const c = createContact({
      full_name: '  Grace Hopper  ',
      title: '   ',
      company: '',
      email: '  grace@navy.mil  ',
      phone: undefined,
      notes: null,
    });
    expect(c.full_name).toBe('Grace Hopper');
    expect(c.title).toBeNull();
    expect(c.company).toBeNull();
    expect(c.email).toBe('grace@navy.mil');
    expect(c.phone).toBeNull();
    expect(c.notes).toBeNull();
  });

  it('returns null for a missing id', () => {
    expect(getContact(99999)).toBeNull();
  });
});

describe('listContacts ordering', () => {
  it('orders dated rows first (DESC), then nulls last, then by name ASC', () => {
    createContact({ full_name: 'Older Date', connected_on: '2024-01-01' });
    createContact({ full_name: 'Newer Date', connected_on: '2024-06-01' });
    createContact({ full_name: 'Zeb No Date' }); // null connected_on
    createContact({ full_name: 'Amy No Date' }); // null connected_on

    const names = listContacts().map((c) => c.full_name);
    expect(names).toEqual(['Newer Date', 'Older Date', 'Amy No Date', 'Zeb No Date']);
  });
});

describe('listContacts search', () => {
  beforeEach(() => {
    createContact({ full_name: 'Alice Smith', company: 'Acme', email: 'alice@acme.io' });
    createContact({ full_name: 'Bob Jones', title: 'CTO', notes: 'met at conf' });
    createContact({ full_name: 'Discount 50%', company: 'Sale Co' });
    createContact({ full_name: 'a_b underscore' });
    createContact({ full_name: 'axb literal' });
  });

  it('matches across multiple columns', () => {
    expect(listContacts('acme').map((c) => c.full_name)).toContain('Alice Smith');
    expect(listContacts('CTO').map((c) => c.full_name)).toEqual(['Bob Jones']);
    expect(listContacts('conf').map((c) => c.full_name)).toEqual(['Bob Jones']);
  });

  it('treats LIKE wildcards as literals (% is escaped)', () => {
    // A bare "%" must NOT match every row — only the one containing a literal %.
    const pct = listContacts('%').map((c) => c.full_name);
    expect(pct).toEqual(['Discount 50%']);
    expect(listContacts('50%').map((c) => c.full_name)).toEqual(['Discount 50%']);
  });

  it('treats LIKE underscore as a literal', () => {
    // "a_b" should match the literal underscore, not "axb".
    const res = listContacts('a_b').map((c) => c.full_name);
    expect(res).toEqual(['a_b underscore']);
  });

  it('returns all rows for blank/whitespace queries', () => {
    expect(listContacts('').length).toBe(5);
    expect(listContacts('   ').length).toBe(5);
    expect(listContacts(undefined).length).toBe(5);
  });
});

describe('updateContact', () => {
  it('updates fields and returns the new row', () => {
    const c = createContact({ full_name: 'Old Name', company: 'OldCo' });
    const updated = updateContact(c.id, { full_name: 'New Name', company: '  ' });
    expect(updated).not.toBeNull();
    expect(updated!.full_name).toBe('New Name');
    expect(updated!.company).toBeNull();
    expect(getContact(c.id)!.full_name).toBe('New Name');
  });

  it('returns null for a missing id', () => {
    expect(updateContact(99999, { full_name: 'Nobody' })).toBeNull();
  });
});

describe('alternate emails, phones and links', () => {
  it('create writes the lists, normalised', () => {
    const c = createContact({
      full_name: 'Ada Lovelace',
      email: 'ada@example.com',
      alt_emails: ' ada.home@example.com \n\n ada.work@example.com ',
      alt_phones: '',
      urls: 'https://example.com/ada',
    });
    expect(c.alt_emails).toBe('ada.home@example.com\nada.work@example.com');
    expect(c.alt_phones).toBeNull();
    expect(c.urls).toBe('https://example.com/ada');
  });

  it('update leaves the lists alone when the keys are absent', () => {
    const c = createContact({ full_name: 'Ada', alt_emails: 'x@example.com', urls: 'https://a.example' });
    const u = updateContact(c.id, { full_name: 'Ada L' })!;
    expect(u.alt_emails).toBe('x@example.com');
    expect(u.urls).toBe('https://a.example');
  });

  it('update clears a list when given null and replaces it when given text', () => {
    const c = createContact({ full_name: 'Ada', alt_emails: 'x@example.com', alt_phones: '+1 202 555 0101' });
    const u = updateContact(c.id, { full_name: 'Ada', alt_emails: null, alt_phones: '+1 202 555 0199\n+1 202 555 0198' })!;
    expect(u.alt_emails).toBeNull();
    expect(u.alt_phones).toBe('+1 202 555 0199\n+1 202 555 0198');
  });
});

describe('deleteContact / countContacts', () => {
  it('deletes an existing contact and reports the change', () => {
    const c = createContact({ full_name: 'Temp Person' });
    expect(countContacts()).toBe(1);
    expect(deleteContact(c.id)).toBe(true);
    expect(countContacts()).toBe(0);
    expect(getContact(c.id)).toBeNull();
  });

  it('returns false when nothing was deleted', () => {
    expect(deleteContact(99999)).toBe(false);
  });
});

describe('line breaks', () => {
  it('stores notes typed in the edit form with \\n line breaks', () => {
    const c = createContact({ full_name: 'Line Breaks', notes: 'first\r\nsecond\rthird' });
    expect(c.notes).toBe('first\nsecond\nthird');
  });
});

describe('search', () => {
  const names = (q: string) => listContacts(q).map((c) => c.full_name).sort();
  beforeEach(() => {
    createContact({ full_name: 'Inès Lefèvre-Brontë', company: 'Café Société', email: 'ines@example.com' });
    createContact({ full_name: 'Élodie Øvreås', phone: '(303) 555-0177' });
    createContact({ full_name: 'José Núñez-Ibáñez', company: 'Ibérica Software', alt_phones: '+34 915 555 010' });
    createContact({ full_name: 'Wendell Wordorder', company: 'Quarry Partners' });
    createContact({ full_name: 'Łukasz Ostrowski' });
  });

  it('ignores case in every script and ignores accents', () => {
    expect(names('élodie')).toEqual(['Élodie Øvreås']);
    expect(names('ELODIE OVREAS')).toEqual(['Élodie Øvreås']);
    expect(names('lefevre')).toEqual(['Inès Lefèvre-Brontë']);
    expect(names('cafe societe')).toEqual(['Inès Lefèvre-Brontë']);
    expect(names('nunez')).toEqual(['José Núñez-Ibáñez']);
    expect(names('ibanez')).toEqual(['José Núñez-Ibáñez']);
    expect(names('lukasz')).toEqual(['Łukasz Ostrowski']);
  });

  it('matches each word, in any order, across fields', () => {
    expect(names('Wordorder Wendell')).toEqual(['Wendell Wordorder']);
    expect(names('Wendell  Wordorder')).toEqual(['Wendell Wordorder']);
    expect(names('wendell quarry')).toEqual(['Wendell Wordorder']);
    expect(names('wendell ines')).toEqual([]);
  });

  it('finds a phone number however it is typed', () => {
    for (const q of ['(303) 555-0177', '303-555-0177', '3035550177', '+1 303 555 0177', '+13035550177', '555-0177']) {
      expect(names(q), q).toEqual(['Élodie Øvreås']);
    }
    expect(names('915 555 010')).toEqual(['José Núñez-Ibáñez']);
    expect(names('+34915555010')).toEqual(['José Núñez-Ibáñez']);
  });
});
