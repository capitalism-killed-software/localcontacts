import type { ContactFilter, ContactStats, IndustryCount, SourceCount } from './contacts';

// The Groups column: "All Contacts", then the origin tags, the industries and
// the smart groups (completeness filters). Each item carries the context
// override its link applies; the three dimensions still compose.

export const TAG_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  iphone: 'iPhone',
  apple: 'Apple',
  google: 'Google',
  'google-personal': 'Google personal',
  'google-work': 'Google work',
  outlook: 'Outlook',
  proton: 'Proton',
  telegram: 'Telegram',
  thunderbird: 'Thunderbird',
  vcard: 'vCard',
  csv: 'CSV',
};

export const tagLabel = (tag: string): string =>
  TAG_LABELS[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]+/g, ' ');

export type ContextOverride = { filter?: string; source?: string; industry?: string };
export type GroupItem = { key: string; label: string; count: number; over: ContextOverride; active: boolean };
export type GroupSection = { title: string; items: GroupItem[] };
export type ActiveContext = { filter: string; source: string; industry: string };

export const SMART_GROUPS: Array<{ key: ContactFilter; label: string; count: (s: ContactStats) => number }> = [
  { key: 'email', label: 'Has email', count: (s) => s.withEmail },
  { key: 'phone', label: 'Has phone', count: (s) => s.withPhone },
  { key: 'email_phone', label: 'Email + phone', count: (s) => s.withBoth },
  { key: 'no_email', label: 'Missing email', count: (s) => s.total - s.withEmail },
  { key: 'no_phone', label: 'Missing phone', count: (s) => s.total - s.withPhone },
  { key: 'has_notes', label: 'Has notes', count: (s) => s.withNotes },
  { key: 'name_is_email', label: 'Name = email', count: (s) => s.nameIsEmail },
];

export function buildGroups(
  stats: ContactStats,
  srcCounts: { tags: SourceCount[]; untagged: number },
  indCounts: { industries: IndustryCount[]; unclassified: number },
  active: ActiveContext
): { all: GroupItem; sections: GroupSection[] } {
  const all: GroupItem = {
    key: 'all',
    label: 'All Contacts',
    count: stats.total,
    over: { filter: 'all', source: 'all', industry: 'all' },
    active: active.filter === 'all' && active.source === 'all' && active.industry === 'all',
  };

  const sources: GroupItem[] = srcCounts.tags.map((t) => ({
    key: `source:${t.tag}`,
    label: tagLabel(t.tag),
    count: t.count,
    over: { source: t.tag },
    active: active.source === t.tag,
  }));
  if (srcCounts.untagged > 0 && srcCounts.tags.length > 0) {
    sources.push({
      key: 'source:untagged',
      label: 'Untagged',
      count: srcCounts.untagged,
      over: { source: 'untagged' },
      active: active.source === 'untagged',
    });
  }

  const industries: GroupItem[] = indCounts.industries.map((i) => ({
    key: `industry:${i.industry}`,
    label: i.industry,
    count: i.count,
    over: { industry: i.industry },
    active: active.industry === i.industry,
  }));
  if (indCounts.unclassified > 0 && indCounts.industries.length > 0) {
    industries.push({
      key: 'industry:none',
      label: 'Unclassified',
      count: indCounts.unclassified,
      over: { industry: 'none' },
      active: active.industry === 'none',
    });
  }

  const smart: GroupItem[] = SMART_GROUPS.map((g) => ({
    key: `filter:${g.key}`,
    label: g.label,
    count: g.count(stats),
    over: { filter: g.key },
    active: active.filter === g.key,
  }));

  const sections: GroupSection[] = [];
  if (sources.length) sections.push({ title: 'Sources', items: sources });
  if (industries.length) sections.push({ title: 'Industry', items: industries });
  sections.push({ title: 'Smart Groups', items: smart });
  return { all, sections };
}
