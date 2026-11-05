import Link from 'next/link';
import type { Contact } from '@/lib/contacts';
import type { Sheet } from '@/lib/context';
import CardEdit, { CARD_FORM_ID } from './CardEdit';
import CardView from './CardView';
import DeleteButton from './DeleteButton';
import ImportPanel from './ImportPanel';
import Silhouette from './Silhouette';

export type CardMode = 'empty' | 'welcome' | 'missing' | 'view' | 'edit' | 'new' | Sheet;

type Action = (fd: FormData) => void | Promise<void>;

// The right page. The footer buttons change with the mode, like Address
// Book's Edit / Done bar.
export default function CardPane({
  mode,
  importHref,
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
      body = <ImportPanel doneHref={listHref} />;
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
          <Link href={importHref} scroll={false} prefetch={false} className="quiet-link">
            Bring in my contacts…
          </Link>
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
      <Link href={listHref} scroll={false} prefetch={false} className="back-link">
        ‹ All Contacts
      </Link>
      <div className="card-scroll">{body}</div>
      <footer className="card-footer">{footer}</footer>
    </section>
  );
}
