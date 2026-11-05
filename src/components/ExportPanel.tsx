import Link from 'next/link';

// The export sheet: what the book shows (all of it, a group, a search) as a
// file. Plain download links, never <Link>: a prefetch would run the export.
export default function ExportPanel({
  scope,
  count,
  total,
  qs,
  allHref,
}: {
  scope: string;
  count: number;
  total: number;
  qs: string;
  allHref: string | null;
}) {
  const href = (format: 'vcard' | 'csv') => `/api/export?${qs ? `${qs}&` : ''}format=${format}`;
  const cards = (n: number) => `${n.toLocaleString()} card${n === 1 ? '' : 's'}`;
  return (
    <div className="card export-panel">
      <h1 className="card-name">Export Contacts</h1>
      <p className="card-company">Save your contacts as a file: to keep, to send, or to bring into another app.</p>
      <hr className="card-divider" />

      <p className="export-scope">
        <strong>{scope}</strong>: {cards(count)}
      </p>
      {allHref && (
        <p className="drop-sub">
          <Link href={allHref} scroll={false} prefetch={false}>
            Export all {cards(total)} instead
          </Link>
        </p>
      )}

      {count === 0 ? (
        <p className="import-status">There are no cards to export here.</p>
      ) : (
        <>
          <div className="export-choice">
            <a href={href('vcard')} download className="btn btn-done">
              vCard (.vcf)
            </a>
            <span className="drop-sub">For Apple Contacts, Google Contacts, Outlook and phones. Photos included.</span>
          </div>
          <div className="export-choice">
            <a href={href('csv')} download className="btn">
              Spreadsheet (.csv)
            </a>
            <span className="drop-sub">
              Opens in Excel, Numbers or Google Sheets. A cell that starts with <code>=</code>, <code>+</code>,{' '}
              <code>-</code> or <code>@</code> gets an apostrophe in front, so the spreadsheet shows it as text instead
              of running it as a formula.
            </span>
          </div>
          <p className="drop-sub">Either file can be imported here again without losing anything.</p>
        </>
      )}
    </div>
  );
}
