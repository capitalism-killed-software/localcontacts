import { describe, expect, it } from 'vitest';
import type { Contact } from '../src/lib/contacts';
import { buildNamesPayload } from '../src/lib/names-payload';

const c = (id: number, full_name: string) => ({ id, full_name }) as Contact;

describe('buildNamesPayload', () => {
  it('orders by surname with section starts and # last', () => {
    const p = buildNamesPayload([c(1, 'Zed Alpha'), c(2, '(no name)'), c(3, 'Ada Lovelace'), c(4, 'Bob Lovelace')], 'last');
    expect(p.count).toBe(4);
    expect(p.truncated).toBe(false);
    expect(p.rows).toEqual([[1, 'Zed Alpha'], [3, 'Ada Lovelace'], [4, 'Bob Lovelace'], [2, '(no name)']]);
    expect(p.sections).toEqual([{ letter: 'A', start: 0 }, { letter: 'L', start: 1 }, { letter: '#', start: 3 }]);
  });
  it('keeps the database order and no sections for other sorts', () => {
    const p = buildNamesPayload([c(2, 'B'), c(1, 'A')], 'company');
    expect(p.rows).toEqual([[2, 'B'], [1, 'A']]);
    expect(p.sections).toBeNull();
  });
});
