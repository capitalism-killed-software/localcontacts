import Link from 'next/link';
import { notFound } from 'next/navigation';
import CopyButton from '@/components/CopyButton';
import ContactForm from '@/components/ContactForm';
import DeleteButton from '@/components/DeleteButton';
import { getContact } from '@/lib/contacts';
import { updateContactAction, deleteContactAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default function ContactDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { edit?: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const contact = getContact(id);
  if (!contact) notFound();

  const editing = searchParams.edit === '1';

  const update = updateContactAction.bind(null, contact.id);
  const remove = deleteContactAction.bind(null, contact.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs text-neutral-500 hover:underline">
            ← Back to all contacts
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{contact.full_name}</h1>
          <p className="text-sm text-neutral-500">
            {[contact.title, contact.company].filter(Boolean).join(' · ') || 'No title or company'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Link
              href={`/contacts/${contact.id}?edit=1`}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:border-neutral-400"
            >
              Edit
            </Link>
          ) : (
            <Link
              href={`/contacts/${contact.id}`}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:border-neutral-400"
            >
              Cancel
            </Link>
          )}
          <DeleteButton action={remove} confirmText={`Delete ${contact.full_name}?`} />
        </div>
      </div>

      {editing ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <ContactForm contact={contact} action={update} submitLabel="Save changes" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email" value={contact.email} copyable copyLabel="email" flagIfEmpty />
          <Field label="Phone" value={contact.phone} copyable copyLabel="phone" flagIfEmpty />
          <Field label="Title" value={contact.title} />
          <Field label="Company" value={contact.company} />
          <Field label="Industry" value={contact.industry} />
          <Field label="Connected on" value={contact.connected_on} />
          <Field label="Last contacted" value={contact.last_contacted} />
          <Field label="Updated" value={contact.updated_at} />
          {contact.notes && (
            <div className="sm:col-span-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Notes
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{contact.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  copyable = false,
  copyLabel,
  flagIfEmpty = false,
}: {
  label: string;
  value: string | null;
  copyable?: boolean;
  copyLabel?: string;
  flagIfEmpty?: boolean;
}) {
  // A flagged-but-empty field (missing email/phone) gets a yellow card so it's
  // obvious there's a gap to fill in via Edit.
  const empty = value === null || value === '';
  const flagged = flagIfEmpty && empty;
  return (
    <div
      className={
        flagged
          ? 'rounded-lg border border-amber-300 bg-amber-100 p-4 shadow-sm'
          : 'rounded-lg border border-neutral-200 bg-white p-4 shadow-sm'
      }
    >
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="break-all text-sm text-neutral-900">
          {empty ? (
            flagged ? (
              <span className="font-medium text-amber-700">Missing — add</span>
            ) : (
              <span className="text-neutral-400">—</span>
            )
          ) : (
            value
          )}
        </div>
        {copyable && !empty && <CopyButton value={value} label={copyLabel} />}
      </div>
    </div>
  );
}
