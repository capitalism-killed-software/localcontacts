import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDb } from '../src/lib/db';
import { createContact, getContact, getPhoto, listContacts, setPhoto } from '../src/lib/contacts';
import { contactToVcard } from '../src/lib/export/vcard';
import { parseText, planMerge, type Batch, type ExistingRow } from '../src/lib/import';
import { isWholeImage, MAX_PHOTO_BYTES, photoFromBase64, photoFromBytes, photoFromDataUri, sniffImage } from '../src/lib/photo';
import { GET } from '../src/app/api/photo/[id]/route';

// A real 1x1 PNG.
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG = Buffer.from(PNG_B64, 'base64');
// Real images made by a browser, and a 1x1 GIF.
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAwADADASIAAhEBAxEB/8QAGgAAAgMBAQAAAAAAAAAAAAAAAAMEBQYBAv/EACgQAAIBAwEHBAMAAAAAAAAAAAECAAMREgQFFTFBU6LREyFScTJhgf/EABgBAAMBAQAAAAAAAAAAAAAAAAIDBAEF/8QAHREAAwACAgMAAAAAAAAAAAAAAAERAhQSEyExYf/aAAwDAQACEQMRAD8A2ucM4jOdDEmw4mWQnHZwzkujpERQXGTc78oVtIjqSgxblbnJdnDlB/RlKRM4ZxJYg2PETmcqggRnPVOrhUVjyIMj5wzmtUymmVgyhlNwRcGDMEUsxsALkzO09rNoxia6KPi5EKm1m1gxFdGHxQic/Ty5e/Bbs4z6MqVc6jMOZJnnOJzhnOglCKiM5U7R2o+ZoadsQPZnHG/6k2o7em2H5WNvuUu79V0u4eYxIBsjEkm5NyYAkG4NiJI3fqul3DzDd+q6XcPMMAnbO2o+YoahsgfZXPH+y2zmc3fqul3DzLqm7emufs1hf7gNBpn/2Q==', 'base64');
const WEBP = Buffer.from('UklGRhQCAABXRUJQVlA4WAoAAAAwAAAAAQAAAQAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZBTFBIBQAAAAD/AAAAAFZQOCAYAAAAMAEAnQEqAgACAAFAJiWkAANwAP79NmgA', 'base64');
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

beforeAll(() => {
  process.env.CONTACTS_DB_PATH = ':memory:';
});
beforeEach(() => {
  closeDb();
});

describe('photo bytes', () => {
  it('recognises images by their bytes', () => {
    expect(sniffImage(PNG)).toBe('image/png');
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImage(Buffer.from('GIF89a'))).toBe('image/gif');
    expect(sniffImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });
  it('rejects empty, oversized and non-image data', () => {
    expect(photoFromBytes(new Uint8Array())).toEqual({ error: 'empty' });
    expect(photoFromBytes(new Uint8Array(MAX_PHOTO_BYTES + 1))).toEqual({ error: 'too-large' });
    expect(photoFromBase64('PGh0bWw+')).toEqual({ error: 'not-image' });
    expect(photoFromBase64('not base64 !!')).toEqual({ error: 'not-image' });
  });
  it('reads base64 with line breaks and data URIs', () => {
    const r = photoFromBase64(PNG_B64.slice(0, 20) + '\n ' + PNG_B64.slice(20));
    expect('photo' in r && r.photo.type).toBe('image/png');
    const d = photoFromDataUri(`data:image/png;base64,${PNG_B64}`);
    expect('photo' in d && d.photo.data.equals(PNG)).toBe(true);
    expect(photoFromDataUri('data:image/png,rawtext')).toEqual({ error: 'not-image' });
  });
});

describe('vCard photos', () => {
  const card = (photoLine: string) => `BEGIN:VCARD\nVERSION:3.0\nFN:Ada Lovelace\n${photoLine}\nEND:VCARD\n`;
  it('reads vCard 3.0, 2.1 and 4.0 photos', () => {
    for (const line of [
      `PHOTO;ENCODING=b;TYPE=PNG:${PNG_B64}`,
      `PHOTO;ENCODING=BASE64;PNG:${PNG_B64}`,
      `PHOTO:data:image/png;base64,${PNG_B64}`,
    ]) {
      const { contacts, warnings } = parseText(card(line), 'vcard');
      expect(contacts[0].photo?.data.equals(PNG), line).toBe(true);
      expect(warnings).toContain('1 photo(s) kept');
    }
  });
  it('keeps a folded photo intact', () => {
    const folded = `PHOTO;ENCODING=b;TYPE=PNG:${PNG_B64.slice(0, 30)}\n ${PNG_B64.slice(30, 60)}\n ${PNG_B64.slice(60)}`;
    expect(parseText(card(folded), 'vcard').contacts[0].photo?.data.equals(PNG)).toBe(true);
  });
  it('never fetches a linked photo and skips non-images', () => {
    const linked = parseText(card('PHOTO;VALUE=uri:https://example.com/ada.jpg'), 'vcard');
    expect(linked.contacts[0].photo).toBeNull();
    expect(linked.warnings).toContain('1 photo(s) skipped: only a link (not fetched)');
    const html = parseText(card('PHOTO;ENCODING=b;TYPE=JPEG:PGh0bWw+PC9odG1sPg=='), 'vcard');
    expect(html.contacts[0].photo).toBeNull();
    expect(html.warnings.join(' ')).toMatch(/not a JPEG, PNG, GIF or WebP/);
  });
  it('writes the photo back out and reads it again', () => {
    const c = createContact({ full_name: 'Ada Lovelace' });
    const photo = (photoFromBytes(PNG) as { photo: NonNullable<ReturnType<typeof getPhoto>> }).photo;
    const text = contactToVcard(getContact(c.id)!, photo);
    expect(text).toContain('PHOTO;ENCODING=b;TYPE=PNG:');
    expect(parseText(text, 'vcard').contacts[0].photo?.data.equals(PNG)).toBe(true);
  });
});

describe('merging photos', () => {
  const row = (over: Partial<ExistingRow>): ExistingRow => ({
    id: 1, full_name: 'Ada', title: null, company: null, email: 'ada@example.com', phone: null, alt_emails: null,
    alt_phones: null, urls: null, notes: null, connected_on: null, last_contacted: null, sources: null, ...over,
  });
  const photo = (photoFromBytes(PNG) as { photo: NonNullable<ReturnType<typeof getPhoto>> }).photo;
  const batch: Batch = { source: 'apple', contacts: [{ name: 'Ada', emails: ['ada@example.com'], phones: [], org: null, title: null, notes: null, urls: [], connected_on: null, photo }] };

  it('fills an empty frame but never replaces a stored photo', () => {
    const filled = planMerge([row({})], [batch], { country: 'US' });
    expect(filled.rows[0].photo).toBe(photo);
    expect(filled.stats.addedPhotos).toBe(1);
    const kept = planMerge([row({ has_photo: 1 })], [batch], { country: 'US' });
    expect(kept.rows[0].photo).toBeNull();
    expect(kept.stats.addedPhotos).toBe(0);
  });
});

describe('storing and serving photos', () => {
  it('stores, lists the type only, serves and removes', async () => {
    const c = createContact({ full_name: 'Ada' });
    expect(getContact(c.id)!.photo_type).toBeNull();
    setPhoto(c.id, { type: 'image/png', data: PNG });
    expect(getContact(c.id)!.photo_type).toBe('image/png');
    expect(Object.keys(listContacts()[0])).not.toContain('photo');
    expect(getPhoto(c.id)!.data.equals(PNG)).toBe(true);

    const res = await GET(new Request('http://t/api/photo/1'), { params: Promise.resolve({ id: String(c.id) }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);

    setPhoto(c.id, null);
    expect(getPhoto(c.id)).toBeNull();
    const gone = await GET(new Request('http://t/api/photo/1'), { params: Promise.resolve({ id: String(c.id) }) });
    expect(gone.status).toBe(404);
  });
});

describe('whole images only', () => {
  it('accepts complete JPEG, PNG, GIF and WebP files', () => {
    for (const [type, b] of [['image/jpeg', JPEG], ['image/png', PNG], ['image/gif', GIF], ['image/webp', WEBP]] as const) {
      expect(sniffImage(b), type).toBe(type);
      expect(isWholeImage(type, b), type).toBe(true);
      expect('photo' in photoFromBytes(b), type).toBe(true);
    }
    // Zero padding after the end does no harm.
    expect(isWholeImage('image/jpeg', Buffer.concat([JPEG, Buffer.alloc(16)]))).toBe(true);
  });

  it('refuses a signature alone, a cut-off file, and a file dressed up as an image', () => {
    const cases: Array<[string, Buffer]> = [
      ['png signature only', PNG.subarray(0, 8)],
      ['png cut at 40 bytes', PNG.subarray(0, 40)],
      ['jpeg cut in half', JPEG.subarray(0, Math.floor(JPEG.length / 2))],
      ['gif header then html', Buffer.from('GIF89a<html><script>alert(1)</script></html>')],
      ['webp cut short', WEBP.subarray(0, WEBP.length - 20)],
    ];
    for (const [label, b] of cases) expect(photoFromBytes(b), label).toEqual({ error: 'damaged' });
  });

  it('skips a damaged photo in a vCard and says why', () => {
    const card = (line: string) => `BEGIN:VCARD\nVERSION:3.0\nFN:Ada Lovelace\n${line}\nEND:VCARD\n`;
    const r = parseText(card(`PHOTO;ENCODING=b;TYPE=JPEG:${JPEG.subarray(0, 114).toString('base64')}`), 'vcard');
    expect(r.contacts[0].photo).toBeNull();
    expect(r.warnings.join(' ')).toMatch(/1 photo\(s\) skipped: damaged or cut off/);
  });
});
