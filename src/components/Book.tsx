import type { ReactNode } from 'react';
import GroupsToggle from './GroupsToggle';
import { relative, isAbsolute } from 'node:path';
import { dbPath } from '@/lib/db';

// Where the database is, as the footer shows it: relative to the app when it is inside it.
export function databaseLabel(): string {
  const path = dbPath();
  if (path === ':memory:') return 'memory';
  const rel = relative(process.cwd(), path);
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel.split('\\').join('/') : path;
}

// The leather book: two pages, the groups and names on the left, the card
// on the right. `view` drives the phone layout, where only one page shows.
export default function Book({
  view,
  groups,
  names,
  card,
}: {
  view: 'list' | 'card';
  groups: ReactNode;
  names: ReactNode;
  card: ReactNode;
}) {
  return (
    <div className="desk">
      {/* data-groups is set by GroupsToggle once the saved choice is known; until then the
          inline script in layout.tsx has marked <html> so the right column shows from the start. */}
      <div className="book" data-view={view}>
        <span className="spine spine-top" aria-hidden="true" />
        <span className="spine spine-bottom" aria-hidden="true" />
        <div className="page page-left">
          <span className="page-edge page-edge-left" aria-hidden="true" />
          <GroupsToggle />
          {groups}
          {names}
        </div>
        <div className="gutter" aria-hidden="true">
          <span className="fold" />
          <span className="stitch" />
          <span className="stitch" />
          <span className="stitch" />
          <span className="stitch" />
        </div>
        <div className="page page-right">
          <span className="page-edge page-edge-right" aria-hidden="true" />
          {card}
        </div>
      </div>
      <p className="desk-caption">
        Local only · SQLite at <code>{databaseLabel()}</code>
      </p>
    </div>
  );
}
