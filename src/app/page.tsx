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
  listVersion,
  sourceCounts,
} from '@/lib/contacts';
import { VIEW_SORTS, parseBook } from '@/lib/context';
import { buildGroups, type ContextOverride } from '@/lib/groups';
import { bookHref, contextQs } from '@/lib/urls';

export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;

export default async function HomePage(props: { searchParams: Promise<Params> }) {
  const searchParams = await props.searchParams;
  const srcCounts = sourceCounts();
  const knownTags = new Set(srcCounts.tags.map((t) => t.tag));
  const { q, filter, source, industry, viewSort, dir, id, isNew, sheet, edit } = parseBook(searchParams, { knownTags });

  const stats = contactStats();
  const indCounts = industryCounts();
  const selected = !isNew && !sheet && id ? getContact(id) : null;

  const context = { q, filter, source, industry, sort: viewSort, dir: dir ?? '' };
  const qs = contextQs(context);
  const selId = isNew || sheet ? null : id;
  const importHref = bookHref(qs, { sheet: 'import' });
  const hrefWith = (over: ContextOverride & { sort?: string }) =>
    bookHref(contextQs({ ...context, ...over }), { id: selId });

  const groups = buildGroups(stats, srcCounts, indCounts, { filter, source, industry });

  const cardMode: CardMode = isNew
    ? 'new'
    : sheet
      ? sheet
      : !id
        ? stats.total === 0
          ? 'welcome'
          : 'empty'
        : !selected
          ? 'missing'
          : edit
            ? 'edit'
            : 'view';
  const view = isNew || sheet || id ? 'card' : 'list';

  const activeGroupKey = groups.all.active
    ? groups.all.key
    : groups.sections.flatMap((s) => s.items).find((i) => i.active)?.key ?? groups.all.key;
  const groupsSelect = (
    <NavSelect
      className="groups-select"
      ariaLabel="Group"
      value={activeGroupKey}
      options={[
        { value: groups.all.key, label: groups.all.label, href: hrefWith(groups.all.over) },
        { value: 'import', label: 'Import contacts…', href: importHref },
      ]}
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
      groups={<GroupsPane all={groups.all} sections={groups.sections} hrefFor={(item) => hrefWith(item.over)} importHref={importHref} />}
      names={
        <NamesPane
          search={<SearchBar />}
          groupsSelect={groupsSelect}
          sortSelect={sortSelect}
          newHref={bookHref(qs, { new: true })}
          version={listVersion()}
        />
      }
      card={
        <CardPane
          mode={cardMode}
          importHref={importHref}
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
