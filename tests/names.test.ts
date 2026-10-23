import { describe, expect, it } from 'vitest';
import { nameSortKey, sectionLetter, sectionize, splitName } from '../src/lib/names';

describe('splitName', () => {
  it('takes the last token as the surname', () => {
    expect(splitName('Ada Lovelace')).toEqual({ first: 'Ada', last: 'Lovelace', suffix: '' });
    expect(splitName('Grace Brewster Murray Hopper')).toEqual({ first: 'Grace Brewster Murray', last: 'Hopper', suffix: '' });
  });
  it('keeps suffixes after the surname', () => {
    expect(splitName('Martin Luther King Jr.')).toEqual({ first: 'Martin Luther', last: 'King', suffix: 'Jr.' });
    expect(splitName('John Smith III')).toEqual({ first: 'John', last: 'Smith', suffix: 'III' });
    expect(splitName('Jr Smith')).toEqual({ first: 'Jr', last: 'Smith', suffix: '' }); // two tokens: no suffix logic
  });
  it('leaves single tokens, placeholders and email names unsplit', () => {
    expect(splitName('Prince')).toEqual({ first: 'Prince', last: '', suffix: '' });
    expect(splitName('(no name)')).toEqual({ first: '(no name)', last: '', suffix: '' });
    expect(splitName('sam.ortega@example.com')).toEqual({ first: 'sam.ortega@example.com', last: '', suffix: '' });
    expect(splitName('  Ada   Lovelace ')).toEqual({ first: 'Ada', last: 'Lovelace', suffix: '' });
  });
});

describe('nameSortKey / sectionLetter', () => {
  it('folds accents and case', () => {
    expect(nameSortKey('José Núñez-Ibáñez', 'last')).toEqual(['nunez-ibanez', 'jose']);
    expect(nameSortKey('José Núñez-Ibáñez', 'first')).toEqual(['jose', 'nunez-ibanez']);
    expect(sectionLetter('nunez-ibanez')).toBe('N');
  });
  it('sends digits, punctuation and non-Latin scripts to #', () => {
    expect(sectionLetter('(no name)')).toBe('#');
    expect(sectionLetter('3m company')).toBe('#');
    expect(sectionLetter('山田')).toBe('#');
  });
});

describe('sectionize', () => {
  const c = (full_name: string, id = 0) => ({ id, full_name });
  it('sorts by surname then first name and buckets by letter with # last', () => {
    const rows = [c('Zed Alpha'), c('(no name)'), c('Ada Lovelace'), c('Alan Turing'), c('Grace Hopper'), c('Bob Lovelace'), c('山田 太郎')];
    const sections = sectionize(rows, 'last');
    expect(sections.map((s) => s.letter)).toEqual(['A', 'H', 'L', 'T', '#']);
    expect(sections[2].items.map((i) => i.contact.full_name)).toEqual(['Ada Lovelace', 'Bob Lovelace']);
    expect(sections[4].items.map((i) => i.contact.full_name)).toEqual(['(no name)', '山田 太郎']);
    expect(sections[2].items[0]).toMatchObject({ first: 'Ada', last: 'Lovelace' });
  });
  it('sorts by first name when asked', () => {
    const sections = sectionize([c('Zed Alpha'), c('Ada Lovelace'), c('Alan Turing')], 'first');
    expect(sections.map((s) => s.letter)).toEqual(['A', 'Z']);
    expect(sections[0].items.map((i) => i.contact.full_name)).toEqual(['Ada Lovelace', 'Alan Turing']);
  });
  it('is stable for ties', () => {
    const sections = sectionize([c('Ada Lovelace', 1), c('Ada Lovelace', 2), c('ada lovelace', 3)], 'last');
    expect(sections[0].items.map((i) => i.contact.id)).toEqual([1, 2, 3]);
  });
  it('handles an empty list', () => {
    expect(sectionize([], 'last')).toEqual([]);
  });
});
