import Link from 'next/link';
import type { Contact } from '@/lib/contacts';
import CardEdit, { CARD_FORM_ID } from './CardEdit';
import CardView from './CardView';
import DeleteButton from './DeleteButton';
import Silhouette from './Silhouette';

export type CardMode = 'empty' | 'missing' | 'view' | 'edit' | 'new';

type Action = (fd: FormData) => void | Promise<void>;

// The right page. The footer buttons change with the mode, like Address
// Book's Edit / Done bar.
export default function CardPane({
  mode,
  contact,
  listHref,
  viewHref,
  editHref,
  create,
  update,
  remove,
}: {
  mode: CardMode;
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
        <Link href={editHref} scroll={false} prefetch={false} className="btn">
          Edit
        </Link>
      );
      break;
    case 'edit':
      body = <CardEdit contact={contact!} action={update!} />;
      footer = (
        <>
          <Link href={viewHref} scroll={false} prefetch={false} className="btn">
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
          <Link href={listHref} scroll={false} prefetch={false} className="btn">
            Cancel
          </Link>
          <button type="submit" form={CARD_FORM_ID} className="btn btn-done">
            Done
          </button>
        </>
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
