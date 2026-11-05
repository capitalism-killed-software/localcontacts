import Link from 'next/link';
import type { ReactNode } from 'react';
import NamesList from './NamesList';

// The names column: search on top, the list, and the bottom bar with "+",
// the sort order and the card count. The list itself is fetched by the
// client so it does not travel with every card click.
export default function NamesPane({
  search,
  groupsSelect,
  sortSelect,
  newHref,
  version,
  sample,
}: {
  search: ReactNode;
  groupsSelect: ReactNode;
  sortSelect: ReactNode;
  newHref: string;
  version: string;
  sample: { count: number; remove: (fd: FormData) => void | Promise<void> } | null;
}) {
  return (
    <section className="names-pane" aria-label="Names">
      <div className="names-top">
        {groupsSelect}
        {search}
      </div>
      {sample && (
        <form className="sample-banner" action={sample.remove}>
          <span>
            {sample.count === 1 ? '1 person here is made up.' : `${sample.count.toLocaleString()} people here are made up.`}
          </span>
          <button type="submit" className="btn">
            Remove them
          </button>
        </form>
      )}
      <NamesList
        version={version}
        footerStart={
          <>
            <Link href={newHref} scroll={false} prefetch={false} className="btn btn-plus" aria-label="New card" title="New card">
              +
            </Link>
            {sortSelect}
          </>
        }
      />
    </section>
  );
}
