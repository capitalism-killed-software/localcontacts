import { describe, expect, it } from 'vitest';
import { listArgs, parseBook } from '../src/lib/context';

describe('parseBook', () => {
  it('reads every parameter from URLSearchParams or a record', () => {
    const a = parseBook(new URLSearchParams('q= ada &filter=no_email&source=linkedin&industry=Legal&sort=company&dir=desc&id=7&edit=1'));
    expect(a).toEqual({ q: 'ada', filter: 'no_email', source: 'linkedin', industry: 'Legal', viewSort: 'company', dir: 'desc', id: 7, isNew: false, sheet: null, edit: true });
    const b = parseBook({ q: ['x', 'y'], id: '3' });
    expect(b.q).toBe('x');
    expect(b.id).toBe(3);
  });
  it('falls back to defaults for junk', () => {
    const p = parseBook(new URLSearchParams('filter=bogus&sort=nope&id=-2&edit=1&source=a%20b'));
    expect(p).toMatchObject({ filter: 'all', viewSort: 'last', id: null, edit: false, source: 'all' });
  });
  it('limits sources to known tags when told them', () => {
    expect(parseBook({ source: 'proton' }, { knownTags: new Set(['linkedin']) }).source).toBe('all');
    expect(parseBook({ source: 'untagged' }, { knownTags: new Set() }).source).toBe('untagged');
  });
  it('a sheet replaces the card and turns off edit; import keeps its old address', () => {
    expect(parseBook({ import: '1', id: '4', edit: '1' })).toMatchObject({ sheet: 'import', edit: false });
    expect(parseBook({ sheet: 'import' }).sheet).toBe('import');
    expect(parseBook({ sheet: 'backups', id: '4', edit: '1' })).toMatchObject({ sheet: 'backups', id: 4, edit: false });
    expect(parseBook({ import: '1', new: '1' })).toMatchObject({ isNew: true, sheet: null });
    expect(parseBook({ sheet: 'nope' }).sheet).toBeNull();
    expect(parseBook({ sheet: 'toString' }).sheet).toBeNull();
  });
  it('new wins over edit', () => {
    expect(parseBook({ new: '1', id: '4', edit: '1' })).toMatchObject({ isNew: true, edit: false });
  });
});

describe('listArgs', () => {
  it('maps view sorts to data-layer sorts', () => {
    expect(listArgs({ viewSort: 'last', dir: null })).toEqual({ sort: 'name', dir: 'asc' });
    expect(listArgs({ viewSort: 'company', dir: 'desc' })).toEqual({ sort: 'company', dir: 'desc' });
    expect(listArgs({ viewSort: 'connected', dir: null })).toEqual({ sort: 'connected', dir: 'desc' });
  });
});
