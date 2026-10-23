import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Contact } from '@/lib/contacts';
import type { NameRow, Section } from '@/lib/names';

// The names column: search, the A–Z list with bold surnames, and the
// bottom bar with "+", the sort order and the card count.
export default function NamesPane({
  sections,
  flat,
  selectedId,
  hrefFor,
  search,
  groupsSelect,
  sortSelect,
  count,
  truncated,
  newHref,
}: {
  sections: Section<Contact>[] | null;
  flat: NameRow<Contact>[] | null;
  selectedId: number | null;
  hrefFor: (id: number) => string;
  search: ReactNode;
  groupsSelect: ReactNode;
  sortSelect: ReactNode;
  count: number;
  truncated: boolean;
  newHref: string;
}) {
  const row = (r: NameRow<Contact>) => {
    const selected = r.contact.id === selectedId;
    return (
      <Link
        key={r.contact.id}
        href={hrefFor(r.contact.id)}
        scroll={false}
        prefetch={false}
        className={`name-row${selected ? ' is-selected' : ''}`}
        aria-current={selected ? 'true' : undefined}
      >
        {r.first}
        {r.last && (
          <>
            {' '}
            <b>{r.last}</b>
          </>
        )}
        {r.suffix && ` ${r.suffix}`}
      </Link>
    );
  };
  const empty = count === 0;
  return (
    <section className="names-pane" aria-label="Names">
      <div className="names-top">
        {groupsSelect}
        {search}
      </div>
      <div className="names-list" role="list">
        {empty && <p className="names-empty">No cards</p>}
        {sections?.map((s) => (
          <div key={s.letter} className="name-section-group">
            <div className="name-section">{s.letter}</div>
            {s.items.map(row)}
          </div>
        ))}
        {flat?.map(row)}
      </div>
      <div className="names-footer">
        <Link href={newHref} scroll={false} prefetch={false} className="btn btn-plus" aria-label="New card" title="New card">
          +
        </Link>
        {sortSelect}
        <span className="names-count">
          {count.toLocaleString()} {count === 1 ? 'card' : 'cards'}
          {truncated ? ' (first 500)' : ''}
        </span>
      </div>
    </section>
  );
}
