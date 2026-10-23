import { describe, expect, it } from 'vitest';
import { buildGroups, tagLabel } from '../src/lib/groups';

const stats = { total: 10, withEmail: 6, withPhone: 4, withBoth: 3, withNotes: 2, nameIsEmail: 1 };

describe('buildGroups', () => {
  it('builds All Contacts, sources, industries and smart groups with counts and overrides', () => {
    const { all, sections } = buildGroups(
      stats,
      { tags: [{ tag: 'linkedin', count: 7 }, { tag: 'proton', count: 2 }], untagged: 1 },
      { industries: [{ industry: 'Legal', count: 3 }], unclassified: 7 },
      { filter: 'all', source: 'proton', industry: 'all' }
    );
    expect(all).toMatchObject({ label: 'All Contacts', count: 10, active: false, over: { filter: 'all', source: 'all', industry: 'all' } });
    expect(sections.map((s) => s.title)).toEqual(['Sources', 'Industry', 'Smart Groups']);
    expect(sections[0].items.map((i) => [i.label, i.count, i.active])).toEqual([
      ['LinkedIn', 7, false], ['Proton', 2, true], ['Untagged', 1, false],
    ]);
    expect(sections[0].items[1].over).toEqual({ source: 'proton' });
    expect(sections[1].items.map((i) => i.label)).toEqual(['Legal', 'Unclassified']);
    expect(sections[1].items[1].over).toEqual({ industry: 'none' });
    expect(sections[2].items.map((i) => [i.label, i.count])).toEqual([
      ['Has email', 6], ['Has phone', 4], ['Email + phone', 3], ['Missing email', 4], ['Missing phone', 6], ['Has notes', 2], ['Name = email', 1],
    ]);
  });
  it('marks All Contacts active only when nothing is selected, and omits empty sections', () => {
    const { all, sections } = buildGroups(stats, { tags: [], untagged: 10 }, { industries: [], unclassified: 10 }, { filter: 'all', source: 'all', industry: 'all' });
    expect(all.active).toBe(true);
    expect(sections.map((s) => s.title)).toEqual(['Smart Groups']);
  });
});

describe('tagLabel', () => {
  it('uses known labels and title-cases the rest', () => {
    expect(tagLabel('linkedin')).toBe('LinkedIn');
    expect(tagLabel('google-work')).toBe('Google work');
    expect(tagLabel('my_crm-export')).toBe('My crm export');
  });
});
