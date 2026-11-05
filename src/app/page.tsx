import Book from '@/components/Book';
import CardPane, { type CardMode } from '@/components/CardPane';
import GroupsPane from '@/components/GroupsPane';
import NamesPane from '@/components/NamesPane';
import NavSelect from '@/components/NavSelect';
import SearchBar from '@/components/SearchBar';
import { createContactAction, deleteContactAction, loadSampleAction, removeSampleAction, updateContactAction } from '@/app/actions';
import {
  contactStats,
  getContact,
  industryCounts,
  listVersion,
  sourceCounts,
} from '@/lib/contacts';
import { VIEW_SORTS, parseBook } from '@/lib/context';
import { buildGroups, type ContextOverride } from '@/lib/groups';
import { sampleCount } from '@/lib/sample';
import { backupsDir, describeBackup, formatWhen, lastImport, listBackups } from '@/lib/backups';
import { fileSize } from '@/lib/format';
import type { BackupRow, UndoImport } from '@/components/BackupsPanel';
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
  const backupsHref = bookHref(qs, { sheet: 'backups' });
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
  // An empty book opens on the welcome, also on a phone.
  const view = isNew || sheet || id || cardMode === 'welcome' ? 'card' : 'list';
  const samples = sampleCount();

  // The backups sheet's list, read only when it is open.
  let backups: { rows: BackupRow[]; undo: UndoImport | null; total: string; folder: string | null } | null = null;
  if (sheet === 'backups') {
    const list = listBackups();
    const last = lastImport();
    backups = {
      rows: list.map((b) => ({ name: b.name, label: describeBackup(b), when: formatWhen(b.at), cards: b.record?.cards ?? null, size: fileSize(b.size) })),
      undo: last && {
        name: last.entry.name,
        files: last.entry.record!.detail ?? 'files',
        when: formatWhen(last.entry.at),
        changedSince: last.changedSince,
      },
      total: fileSize(list.reduce((n, b) => n + b.size, 0)),
      folder: backupsDir(),
    };
  }

  const activeGroupKey = groups.all.active
    ? groups.all.key
    : groups.sections.flatMap((s) => s.items).find((i) => i.active)?.key ?? groups.all.key;
  // The other sheets, from the "More" menu under the groups (and, on a phone, the groups menu).
  const sheetLinks = [{ value: 'backups', label: 'Backups…', href: backupsHref }];
  const moreMenu = <NavSelect className="sort-select more-select" ariaLabel="More" placeholder="More" value="" options={sheetLinks} />;
  const groupsSelect = (
    <NavSelect
      className="groups-select"
      ariaLabel="Group"
      value={activeGroupKey}
      options={[
        { value: groups.all.key, label: groups.all.label, href: hrefWith(groups.all.over) },
        { value: 'import', label: 'Import contacts…', href: importHref },
        ...sheetLinks,
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
      groups={<GroupsPane all={groups.all} sections={groups.sections} hrefFor={(item) => hrefWith(item.over)} importHref={importHref} more={moreMenu} />}
      names={
        <NamesPane
          search={<SearchBar />}
          groupsSelect={groupsSelect}
          sortSelect={sortSelect}
          newHref={bookHref(qs, { new: true })}
          version={listVersion()}
          sample={samples > 0 ? { count: samples, remove: removeSampleAction.bind(null, qs) } : null}
        />
      }
      card={
        <CardPane
          mode={cardMode}
          importHref={importHref}
          backupsHref={backupsHref}
          sampleCount={samples}
          loadSample={loadSampleAction.bind(null, qs)}
          backups={backups}
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
