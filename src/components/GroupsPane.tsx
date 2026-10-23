import Link from 'next/link';
import type { GroupItem, GroupSection } from '@/lib/groups';

// The Groups column: a Mac source list of links.
export default function GroupsPane({
  all,
  sections,
  hrefFor,
}: {
  all: GroupItem;
  sections: GroupSection[];
  hrefFor: (item: GroupItem) => string;
}) {
  const row = (item: GroupItem, bold = false) => (
    <Link
      key={item.key}
      href={hrefFor(item)}
      scroll={false}
      prefetch={false}
      className={`group${item.active ? ' is-selected' : ''}${bold ? ' group-all' : ''}`}
      aria-current={item.active ? 'true' : undefined}
    >
      <span className="group-label">{item.label}</span>
      <span className="group-count">{item.count.toLocaleString()}</span>
    </Link>
  );
  return (
    <nav className="groups-pane" aria-label="Groups">
      <div className="groups-scroll">
        {row(all, true)}
        {sections.map((sec) => (
          <section key={sec.title}>
            <h3 className="group-header">{sec.title}</h3>
            {sec.items.map((item) => row(item))}
          </section>
        ))}
      </div>
    </nav>
  );
}
