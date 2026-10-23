import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDb } from '../../src/lib/db';
import { createContact } from '../../src/lib/contacts';
import { GET } from '../../src/app/api/vcard/[id]/route';

beforeAll(() => {
  process.env.CONTACTS_DB_PATH = ':memory:';
});
beforeEach(() => {
  closeDb();
});

const call = (id: string) => GET(new Request(`http://test/api/vcard/${id}`), { params: Promise.resolve({ id }) });

describe('GET /api/vcard/[id]', () => {
  it('returns the card as a download with a safe filename', async () => {
    const c = createContact({ full_name: 'Zoë "Z" Ñúñez/李', email: 'zoe@example.com' });
    const res = await call(String(c.id));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/vcard; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const cd = res.headers.get('content-disposition')!;
    expect(cd).toMatch(/^attachment; filename="Zoe Z Nunez\.vcf"; filename\*=UTF-8''/);
    expect(decodeURIComponent(cd.split("UTF-8''")[1])).toBe('Zoë Z Ñúñez 李.vcf');
    const body = await res.text();
    expect(body).toContain('EMAIL;TYPE=INTERNET;TYPE=PREF:zoe@example.com\r\n');
  });

  it('404s for unknown or malformed ids', async () => {
    expect((await call('999')).status).toBe(404);
    expect((await call('abc')).status).toBe(404);
    expect((await call('-1')).status).toBe(404);
  });
});
