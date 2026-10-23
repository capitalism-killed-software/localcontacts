import Book from '@/components/Book';
import CardPane, { type CardMode } from '@/components/CardPane';
import GroupsPane from '@/components/GroupsPane';
import NamesPane from '@/components/NamesPane';
import NavSelect from '@/components/NavSelect';
import SearchBar from '@/components/SearchBar';
import { createContactAction, deleteContactAction, updateContactAction } from '@/app/actions';
import {
  contactStats,
  getContact,
  industryCounts,
  listContacts,
  sourceCounts,
  type ContactFilter,
  type SortDir,
  type SortKey,
} from '@/lib/contacts';
import { buildGroups, type ContextOverride } from '@/lib/groups';
import { sectionize, splitName } from '@/lib/names';
import { bookHref, contextQs } from '@/lib/urls';

export const dynamic = 'force-dynamic';

const FILTER_KEYS = new Set<ContactFilter>([
  'all', 'email', 'phone', 'email_phone', 'no_email', 'no_phone', 'has_notes', 'name_is_email',
]);

// How the names list is ordered. The lib sorts by full name; "last" is
// re-sorted by surname in JS.
type ViewSort = 'last' | 'first' | 'company' | 'connected' | 'last_contacted';
const VIEW_SORTS: Array<{ value: ViewSort; label: string }> = [
  { value: 'last', label: 'Last name' },
  { value: 'first', label: 'First name' },
  { value: 'company', label: 'Company' },
  { value: 'connected', label: 'Date connected' },
  { value: 'last_contacted', label: 'Last contacted' },
];
const VIEW_SORT_KEYS = new Set<string>(VIEW_SORTS.map((s) => s.value));

function mapSort(v: ViewSort, dir: 'desc' | null): [SortKey, SortDir] {
  switch (v) {
    case 'company':
      return ['company', dir ?? 'asc'];
    case 'connected':
      return ['connected', 'desc'];
    case 'last_contacted':
      return ['last_contacted', 'desc'];
    default:
      return ['name', 'asc'];
  }
}

type Params = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? '' : v ?? '').trim();

export default function HomePage({ searchParams }: { searchParams: Params }) {
  const q = str(searchParams.q);
  const rawFilter = str(searchParams.filter) as ContactFilter;
  const filter: ContactFilter = FILTER_KEYS.has(rawFilter) ? rawFilter : 'all';
  const srcCounts = sourceCounts();
  const knownTags = new Set(srcCounts.tags.map((t) => t.tag));
  const rawSource = str(searchParams.source) || 'all';
  const source = rawSource === 'all' || rawSource === 'untagged' || knownTags.has(rawSource) ? rawSource : 'all';
  const industry = str(searchParams.industry) || 'all';
  const rawSort = str(searchParams.sort);
  const viewSort: ViewSort = VIEW_SORT_KEYS.has(rawSort) ? (rawSort as ViewSort) : 'last';
  const dir = str(searchParams.dir) === 'desc' ? 'desc' : null;
  const idNum = Number(str(searchParams.id));
  const id = Number.isFinite(idNum) && idNum > 0 ? idNum : null;
  const isNew = str(searchParams.new) === '1';
  const edit = !isNew && str(searchParams.edit) === '1';

  const [libSort, libDir] = mapSort(viewSort, dir);
  const rows = listContacts(q, filter, libSort, libDir, source, industry);
  const stats = contactStats();
  const indCounts = industryCounts();
  const selected = !isNew && id ? getContact(id) : null;

  const context = { q, filter, source, industry, sort: viewSort, dir: dir ?? '' };
  const qs = contextQs(context);
  const selId = isNew ? null : id;
  const hrefWith = (over: ContextOverride & { sort?: string }) =>
    bookHref(contextQs({ ...context, ...over }), { id: selId });

  const groups = buildGroups(stats, srcCounts, indCounts, { filter, source, industry });
  const sections = viewSort === 'last' || viewSort === 'first' ? sectionize(rows, viewSort) : null;
  const flat = sections ? null : rows.map((c) => ({ contact: c, ...splitName(c.full_name) }));

  const cardMode: CardMode = isNew ? 'new' : !id ? 'empty' : !selected ? 'missing' : edit ? 'edit' : 'view';
  const view = isNew || id ? 'card' : 'list';

  const activeGroupKey = groups.all.active
    ? groups.all.key
    : groups.sections.flatMap((s) => s.items).find((i) => i.active)?.key ?? groups.all.key;
  const groupsSelect = (
    <NavSelect
      className="groups-select"
      ariaLabel="Group"
      value={activeGroupKey}
      options={[{ value: groups.all.key, label: groups.all.label, href: hrefWith(groups.all.over) }]}
      groups={groups.sections.map((s) => ({
        label: s.title,
        options: s.items.map((i) => ({ value: i.key, label: `${i.label} (${i.count.toLocaleString()})`, href: hrefWith(i.over) })),
      }))}
    />
  );
  const sortSelect = (
    <NavSelect
      className="sort-select"
      ariaLabel="Sort order"
      value={viewSort}
      options={VIEW_SORTS.map((s) => ({ value: s.value, label: s.label, href: hrefWith({ sort: s.value }) }))}
    />
  );

  return (
    <Book
      view={view}
      groups={<GroupsPane all={groups.all} sections={groups.sections} hrefFor={(item) => hrefWith(item.over)} />}
      names={
        <NamesPane
          sections={sections}
          flat={flat}
          selectedId={selId}
          hrefFor={(cid) => bookHref(qs, { id: cid })}
          search={<SearchBar />}
          groupsSelect={groupsSelect}
          sortSelect={sortSelect}
          count={rows.length}
          truncated={q.length > 0 && rows.length >= 500}
          newHref={bookHref(qs, { new: true })}
        />
      }
      card={
        <CardPane
          mode={cardMode}
          contact={selected}
          listHref={bookHref(qs)}
          viewHref={bookHref(qs, { id })}
          editHref={bookHref(qs, { id, edit: true })}
          create={createContactAction.bind(null, qs)}
          update={selected ? updateContactAction.bind(null, selected.id, qs) : undefined}
          remove={selected ? deleteContactAction.bind(null, selected.id, qs) : undefined}
        />
      }
    />
  );
}
