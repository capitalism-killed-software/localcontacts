import { describe, expect, it } from 'vitest';
import { bookHref, contextQs } from '../src/lib/urls';

describe('contextQs', () => {
  it('keeps only the context params and drops defaults', () => {
    const qs = contextQs(new URLSearchParams('q=ada&filter=all&source=linkedin&industry=all&sort=last&id=5&edit=1&new=1&evil=x'));
    expect(qs).toBe('q=ada&source=linkedin');
  });
  it('keeps sort with dir only when sort is set and dir is desc', () => {
    expect(contextQs({ sort: 'company', dir: 'desc' })).toBe('sort=company&dir=desc');
    expect(contextQs({ sort: 'company', dir: 'asc' })).toBe('sort=company');
    expect(contextQs({ sort: 'last', dir: 'desc' })).toBe('');
    expect(contextQs({ dir: 'desc' })).toBe('');
  });
  it('trims and ignores blanks', () => {
    expect(contextQs({ q: '  ', filter: ' no_email ' })).toBe('filter=no_email');
    expect(contextQs({})).toBe('');
  });
});

describe('bookHref', () => {
  it('builds the root and selection links', () => {
    expect(bookHref('')).toBe('/');
    expect(bookHref('q=ada')).toBe('/?q=ada');
    expect(bookHref('q=ada', { id: 7 })).toBe('/?q=ada&id=7');
    expect(bookHref('', { id: 7, edit: true })).toBe('/?id=7&edit=1');
    expect(bookHref('source=linkedin', { new: true })).toBe('/?source=linkedin&new=1');
  });
  it('new wins over id, and bad ids are ignored', () => {
    expect(bookHref('', { id: 7, new: true })).toBe('/?new=1');
    expect(bookHref('', { id: 0 })).toBe('/');
    expect(bookHref('', { id: Number.NaN, edit: true })).toBe('/');
    expect(bookHref('', { id: null })).toBe('/');
  });
});
