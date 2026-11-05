import { describe, expect, it } from 'vitest';
import { parseId } from '../src/lib/ids';
import { parseBook } from '../src/lib/context';

describe('parseId', () => {
  it('reads plain positive decimal ids', () => {
    expect(parseId('1')).toBe(1);
    expect(parseId('7573')).toBe(7573);
    expect(parseId('9007199254740991')).toBe(9007199254740991);
  });
  it('refuses everything else instead of guessing', () => {
    for (const s of [null, undefined, '', '0', '-1', '1.5', '1.0', '1e3', '0x1', '0b1', '0o1', '+1', ' 1', '1 ', '01', 'abc', '9007199254740993', '99999999999999999999']) {
      expect(parseId(s), String(s)).toBeNull();
    }
  });
  it('is what the book uses for ?id=', () => {
    expect(parseBook({ id: '1e3' }).id).toBeNull();
    expect(parseBook({ id: '1000' }).id).toBe(1000);
    // "+1" in a query string is " 1": not trimmed into an id.
    expect(parseBook(new URLSearchParams('id=+1')).id).toBeNull();
    expect(parseBook({ id: ' 1' }).id).toBeNull();
  });
});
