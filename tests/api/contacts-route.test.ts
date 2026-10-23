import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '../../src/lib/db';
import { createContact, listContacts, listVersion } from '../../src/lib/contacts';
import { GET } from '../../src/app/api/contacts/route';
import type { NamesPayload } from '../../src/lib/names-payload';

beforeAll(() => {
  process.env.CONTACTS_DB_PATH = ':memory:';
});
beforeEach(() => {
  closeDb();
});

const get = async (qs = ''): Promise<{ res: Response; body: NamesPayload }> => {
  const res = await GET(new Request(`http://test/api/contacts${qs}`));
  return { res, body: (await res.json()) as NamesPayload };
};

describe('GET /api/contacts', () => {
  it('returns ids and names in surname order with sections, uncached', async () => {
    createContact({ full_name: 'Grace Hopper', email: 'grace@example.com' });
    createContact({ full_name: 'Ada Lovelace' });
    const { res, body } = await get();
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body.rows.map(([, n]) => n)).toEqual(['Grace Hopper', 'Ada Lovelace']);
    expect(body.sections).toEqual([{ letter: 'H', start: 0 }, { letter: 'L', start: 1 }]);
    expect(body.count).toBe(2);
  });

  it('applies the book filters and ignores junk', async () => {
    createContact({ full_name: 'Grace Hopper', email: 'grace@example.com' });
    createContact({ full_name: 'Ada Lovelace' });
    expect((await get('?filter=no_email')).body.rows.map(([, n]) => n)).toEqual(['Ada Lovelace']);
    expect((await get('?q=grace')).body.count).toBe(1);
    expect((await get('?filter=bogus&sort=nope&source=missing')).body.count).toBe(2);
    expect((await get('?sort=company')).body.sections).toBeNull();
  });

  it('returns more than 500 search results', async () => {
    const db = getDb();
    db.exec('BEGIN');
    const ins = db.prepare('INSERT INTO contacts (full_name) VALUES (?)');
    for (let i = 0; i < 600; i++) ins.run(`Person ${i} Smith`);
    db.exec('COMMIT');
    expect((await get('?q=smith')).body.count).toBe(600);
    expect((await get('?q=smith')).body.truncated).toBe(false);
    expect(listContacts('smith').length).toBe(500); // the default cap is unchanged
  });
});

describe('listVersion', () => {
  it('changes when contacts change', () => {
    const v0 = listVersion();
    const c = createContact({ full_name: 'A' });
    const v1 = listVersion();
    expect(v1).not.toBe(v0);
    getDb().prepare('DELETE FROM contacts WHERE id = ?').run(c.id);
    expect(listVersion()).not.toBe(v1);
  });
});
