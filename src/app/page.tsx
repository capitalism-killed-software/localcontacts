import Link from 'next/link';
import SearchBar from '@/components/SearchBar';
import CopyButton from '@/components/CopyButton';
import {
  contactStats,
  sourceCounts,
  industryCounts,
  listContacts,
  type ContactFilter,
  type SortKey,
  type SortDir,
} from '@/lib/contacts';

export const dynamic = 'force-dynamic';

const FILTERS: { key: ContactFilter; label: string; count: (s: ReturnType<typeof contactStats>) => number }[] = [
  { key: 'all', label: 'All', count: (s) => s.total },
  { key: 'email', label: 'Has email', count: (s) => s.withEmail },
  { key: 'phone', label: 'Has phone', count: (s) => s.withPhone },
  { key: 'email_phone', label: 'Email + phone', count: (s) => s.withBoth },
  { key: 'no_email', label: 'Missing email', count: (s) => s.total - s.withEmail },
  { key: 'no_phone', label: 'Missing phone', count: (s) => s.total - s.withPhone },
  { key: 'has_notes', label: 'Has notes', count: (s) => s.withNotes },
  { key: 'name_is_email', label: 'Name = email', count: (s) => s.nameIsEmail },
];

// Display names for common origin tags; anything else is shown as typed.
const TAG_LABELS: Record<string, string> = {
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
const tagLabel = (tag: string) =>
  TAG_LABELS[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]+/g, ' ');

const FILTER_KEYS = new Set<ContactFilter>(FILTERS.map((f) => f.key));
const SORT_KEYS = new Set<SortKey>([
  'default',
  'name',
  'company',
  'industry',
  'connected',
  'last_contacted',
]);

export default function HomePage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    filter?: string;
    sort?: string;
    dir?: string;
    source?: string;
    industry?: string;
  };
}) {
  const q = (searchParams.q ?? '').trim();
  const filter: ContactFilter = FILTER_KEYS.has(searchParams.filter as ContactFilter)
    ? (searchParams.filter as ContactFilter)
    : 'all';
  const srcCounts = sourceCounts();
  const knownTags = new Set(srcCounts.tags.map((t) => t.tag));
  const rawSource = (searchParams.source ?? 'all').trim();
  const source =
    rawSource === 'all' || rawSource === 'untagged' || knownTags.has(rawSource) ? rawSource : 'all';
  const sort: SortKey = SORT_KEYS.has(searchParams.sort as SortKey)
    ? (searchParams.sort as SortKey)
    : 'default';
  const dir: SortDir = searchParams.dir === 'desc' ? 'desc' : 'asc';
  const industry = (searchParams.industry ?? 'all').trim() || 'all';
  const contacts = listContacts(q, filter, sort, dir, source, industry);
  const stats = contactStats();
  const indCounts = industryCounts();
  const sourceChips: Array<{ key: string; label: string; n: number | null }> = [
    { key: 'all', label: 'Any source', n: null },
    ...srcCounts.tags.map((t) => ({ key: t.tag, label: tagLabel(t.tag), n: t.count })),
    ...(srcCounts.untagged > 0 && srcCounts.tags.length > 0
      ? [{ key: 'untagged', label: 'Untagged', n: srcCounts.untagged }]
      : []),
  ];
  const total = stats.total;

  // Preserve q + the other dimensions; override only what's passed.
  const buildHref = (over: {
    filter?: ContactFilter;
    source?: string;
    industry?: string;
    sort?: SortKey;
    dir?: SortDir;
  }) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    const f = over.filter ?? filter;
    if (f !== 'all') p.set('filter', f);
    const src = over.source ?? source;
    if (src !== 'all') p.set('source', src);
    const ind = over.industry ?? industry;
    if (ind !== 'all') p.set('industry', ind);
    const s = over.sort ?? sort;
    if (s !== 'default') {
      p.set('sort', s);
      const d = over.dir ?? dir;
      if (d !== 'asc') p.set('dir', d);
    }
    const qs = p.toString();
    return qs ? `/?${qs}` : '/';
  };

  const href = (f: ContactFilter) => buildHref({ filter: f });
  const sourceHref = (src: string) => buildHref({ source: src });
  const industryHref = (ind: string) => buildHref({ industry: ind });

  // A sortable column header: clicking cycles asc → desc; switching columns starts at asc.
  const sortHref = (key: SortKey) => {
    const nextDir: SortDir = sort === key && dir === 'asc' ? 'desc' : 'asc';
    return buildHref({ sort: key, dir: nextDir });
  };
  const arrow = (key: SortKey) => (sort !== key ? '' : dir === 'asc' ? ' ↑' : ' ↓');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-neutral-500">
            {q
              ? `${contacts.length} match${contacts.length === 1 ? '' : 'es'} for "${q}" of ${total}`
              : `${contacts.length} shown of ${total} total`}
          </p>
        </div>
      </div>
      <SearchBar />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={href(f.key)}
              className={
                active
                  ? 'rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs font-medium text-white'
                  : 'rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-400'
              }
            >
              {f.label}{' '}
              <span className={active ? 'text-neutral-300' : 'text-neutral-400'}>
                {f.count(stats).toLocaleString()}
              </span>
            </Link>
          );
        })}
      </div>
      {srcCounts.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">Source</span>
          {sourceChips.map((chip) => {
            const active = chip.key === source;
            return (
              <Link
                key={chip.key}
                href={sourceHref(chip.key)}
                className={
                  active
                    ? 'rounded-full border border-sky-700 bg-sky-700 px-3 py-1 text-xs font-medium text-white'
                    : 'rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-400'
                }
              >
                {chip.label}
                {chip.n !== null && (
                  <span className={active ? ' text-sky-200' : ' text-neutral-400'}>
                    {' '}
                    {chip.n.toLocaleString()}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
      {(indCounts.industries.length > 0 || indCounts.unclassified > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Industry
          </span>
          {[
            { key: 'all', label: 'Any industry', n: null as number | null },
            ...indCounts.industries.map((i) => ({ key: i.industry, label: i.industry, n: i.count })),
            { key: 'none', label: 'Unclassified', n: indCounts.unclassified },
          ].map((chip) => {
            const active = chip.key === industry;
            return (
              <Link
                key={chip.key}
                href={industryHref(chip.key)}
                className={
                  active
                    ? 'rounded-full border border-emerald-700 bg-emerald-700 px-3 py-1 text-xs font-medium text-white'
                    : 'rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-400'
                }
              >
                {chip.label}
                {chip.n !== null && (
                  <span className={active ? ' text-emerald-200' : ' text-neutral-400'}>
                    {' '}
                    {chip.n.toLocaleString()}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">
                <Link href={sortHref('name')} className="hover:text-neutral-900">
                  Name{arrow('name')}
                </Link>
              </th>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">
                <Link href={sortHref('company')} className="hover:text-neutral-900">
                  Company{arrow('company')}
                </Link>
              </th>
              <th className="px-4 py-2 font-medium">
                <Link href={sortHref('industry')} className="hover:text-neutral-900">
                  Industry{arrow('industry')}
                </Link>
              </th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">
                <Link href={sortHref('connected')} className="hover:text-neutral-900">
                  Connected{arrow('connected')}
                </Link>
              </th>
              <th className="px-4 py-2 font-medium">
                <Link href={sortHref('last_contacted')} className="hover:text-neutral-900">
                  Last contacted{arrow('last_contacted')}
                </Link>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {contacts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                  No contacts found.
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-neutral-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/contacts/${c.id}`}
                    className="font-medium text-neutral-900 hover:underline"
                  >
                    {c.full_name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-neutral-600">{c.title ?? '—'}</td>
                <td className="px-4 py-2 text-neutral-600">{c.company ?? '—'}</td>
                <td className="px-4 py-2 text-neutral-600">{c.industry ?? '—'}</td>
                <td className={c.email ? 'px-4 py-2' : 'bg-amber-100 px-4 py-2'}>
                  {c.email ? (
                    <span className="inline-flex items-center gap-2">
                      <a
                        href={`mailto:${c.email}`}
                        className="text-neutral-700 hover:underline"
                      >
                        {c.email}
                      </a>
                      <CopyButton value={c.email} label="email" />
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-700">Missing</span>
                  )}
                </td>
                <td className={c.phone ? 'px-4 py-2' : 'bg-amber-100 px-4 py-2'}>
                  {c.phone ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-neutral-700">{c.phone}</span>
                      <CopyButton value={c.phone} label="phone" />
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-700">Missing</span>
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-500">{c.connected_on ?? '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{c.last_contacted ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
