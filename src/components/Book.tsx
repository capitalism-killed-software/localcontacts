import type { ReactNode } from 'react';
import GroupsToggle from './GroupsToggle';

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
      <div className="book" data-view={view} data-groups="shown">
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
        Local only · SQLite at <code>data/contacts.db</code>
      </p>
    </div>
  );
}
