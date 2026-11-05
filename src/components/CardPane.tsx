import Link from 'next/link';
import type { Contact } from '@/lib/contacts';
import type { Sheet } from '@/lib/context';
import CardEdit, { CARD_FORM_ID } from './CardEdit';
import CardView from './CardView';
import DeleteButton from './DeleteButton';
import BackupsPanel, { type BackupRow, type UndoImport } from './BackupsPanel';
import ExportPanel from './ExportPanel';
import ImportPanel from './ImportPanel';
import TidyPanel from './TidyPanel';
import type { TidyData } from '@/lib/cleanup/sheet';
import Silhouette from './Silhouette';

export type CardMode = 'empty' | 'welcome' | 'missing' | 'view' | 'edit' | 'new' | Sheet;

type Action = (fd: FormData) => void | Promise<void>;

// The right page. The footer buttons change with the mode, like Address
// Book's Edit / Done bar.
export default function CardPane({
  mode,
  importHref,
  backupsHref,
  sampleCount,
  loadSample,
  backups,
  exporting,
  tidy,
  tidyHref,
  contact,
  listHref,
  viewHref,
  editHref,
  create,
  update,
  remove,
}: {
  mode: CardMode;
  importHref: string;
  backupsHref: string;
  sampleCount: number;
  loadSample: Action;
  backups: { rows: BackupRow[]; undo: UndoImport | null; total: string; folder: string | null } | null;
  exporting: { scope: string; count: number; total: number; qs: string; allHref: string | null } | null;
  tidy: { data: TidyData; hrefFor: Record<string, string> } | null;
  tidyHref: string;
  contact: Contact | null;
  listHref: string;
  viewHref: string;
  editHref: string;
  create: Action;
  update?: Action;
  remove?: Action;
}) {
  let body: React.ReactNode;
  let footer: React.ReactNode = null;

  switch (mode) {
    case 'view':
      body = <CardView contact={contact!} editHref={editHref} />;
      footer = (
        <>
          <Link href={editHref} scroll={false} prefetch={false} className="btn">
            Edit
          </Link>
          <a href={`/api/vcard/${contact!.id}`} download className="btn" title="Download this card as a vCard">
            Export vCard
          </a>
        </>
      );
      break;
    case 'edit':
      body = <CardEdit contact={contact!} action={update!} />;
      footer = (
        <>
          <Link href={viewHref} scroll={false} prefetch={false} className="btn" data-discard>
            Cancel
          </Link>
          <button type="submit" form={CARD_FORM_ID} className="btn btn-done">
            Done
          </button>
          {remove && <DeleteButton action={remove} confirmText={`Delete the card for ${contact!.full_name}?`} />}
        </>
      );
      break;
    case 'new':
      body = <CardEdit action={create} />;
      footer = (
        <>
          <Link href={listHref} scroll={false} prefetch={false} className="btn" data-discard>
            Cancel
          </Link>
          <button type="submit" form={CARD_FORM_ID} className="btn btn-done">
            Done
          </button>
        </>
      );
      break;
    case 'import':
      body = <ImportPanel doneHref={listHref} backupsHref={backupsHref} tidyHref={tidyHref} sampleCount={sampleCount} />;
      footer = (
        <Link href={listHref} scroll={false} prefetch={false} className="btn">
          Close
        </Link>
      );
      break;
    case 'tidy':
      body = tidy && <TidyPanel {...tidy} />;
      footer = (
        <Link href={listHref} scroll={false} prefetch={false} className="btn">
          Close
        </Link>
      );
      break;
    case 'export':
      body = exporting && <ExportPanel {...exporting} />;
      footer = (
        <Link href={listHref} scroll={false} prefetch={false} className="btn">
          Close
        </Link>
      );
      break;
    case 'backups':
      body = backups && <BackupsPanel {...backups} />;
      footer = (
        <Link href={listHref} scroll={false} prefetch={false} className="btn">
          Close
        </Link>
      );
      break;
    case 'welcome':
      body = (
        <div className="card card-blank welcome">
          <Silhouette />
          <h2 className="welcome-title">Your address book is empty</h2>
          <p className="card-blank-text">Everything stays on this computer.</p>
          <div className="welcome-actions">
            <Link href={importHref} scroll={false} prefetch={false} className="btn btn-done">
              Bring in my contacts…
            </Link>
            <form action={loadSample}>
              <button type="submit" className="btn">
                Look around with sample people
              </button>
            </form>
          </div>
          <Link href="/help/export" prefetch={false} className="quiet-link">
            Where do I get my contacts?
          </Link>
        </div>
      );
      break;
    case 'missing':
      body = (
        <div className="card card-blank">
          <Silhouette />
          <p className="card-blank-text">No card with that id.</p>
          <Link href={listHref} scroll={false} prefetch={false} className="quiet-link">
            All Contacts
          </Link>
        </div>
      );
      break;
    default:
      body = (
        <div className="card card-blank">
          <Silhouette />
          <p className="card-blank-text">No Card Selected</p>
          <Link href={importHref} scroll={false} prefetch={false} className="quiet-link">
            Import contacts…
          </Link>
        </div>
      );
  }

  return (
    <section className="card-pane" aria-label="Card">
      {mode !== 'welcome' && (
        <Link href={listHref} scroll={false} prefetch={false} className="back-link">
          ‹ All Contacts
        </Link>
      )}
      <div className="card-scroll">{body}</div>
      <footer className="card-footer">{footer}</footer>
    </section>
  );
}
