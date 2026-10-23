import type { Contact } from '@/lib/contacts';
import MultiField from './MultiField';
import Silhouette from './Silhouette';

const lines = (v: string | null | undefined): string[] => (v ? v.split('\n').map((s) => s.trim()).filter(Boolean) : []);

// Address Book's edit mode as a plain form. The footer buttons live outside
// the form (the delete control is its own form) and submit it by id.
export const CARD_FORM_ID = 'card-form';

export default function CardEdit({
  contact,
  action,
}: {
  contact?: Contact;
  action: (fd: FormData) => void | Promise<void>;
}) {
  const v = (k: keyof Contact) => (contact?.[k] as string | null | undefined) ?? '';
  const emails = contact ? [contact.email, ...lines(contact.alt_emails)].filter((x): x is string => !!x) : [];
  const phones = contact ? [contact.phone, ...lines(contact.alt_phones)].filter((x): x is string => !!x) : [];
  const urls = lines(contact?.urls);

  return (
    <form id={CARD_FORM_ID} action={action} className="card card-edit">
      <header className="card-head">
        <Silhouette className="photo-editing" />
        <div className="card-titles">
          <input
            name="full_name"
            defaultValue={v('full_name')}
            placeholder="Name"
            aria-label="Name"
            required
            autoFocus
            className="boxed-input boxed-name"
          />
          <input name="company" defaultValue={v('company')} placeholder="Company" aria-label="Company" className="boxed-input" />
          <input name="title" defaultValue={v('title')} placeholder="Job title" aria-label="Job title" className="boxed-input" />
        </div>
      </header>
      <hr className="card-divider" />
      <div className="card-fields">
        <div className="field-group">
          <MultiField name="email" label="email" values={emails} type="email" placeholder="Email" />
          <MultiField name="phone" label="phone" values={phones} type="tel" placeholder="Phone" />
          <MultiField name="url" label="link" values={urls} placeholder="URL" />
        </div>
        <div className="field-group">
          <div className="edit-row">
            <span className="round-btn spacer" />
            <span className="edit-label">industry</span>
            <input name="industry" defaultValue={v('industry')} placeholder="Industry" aria-label="Industry" className="edit-input" />
          </div>
          <div className="edit-row">
            <span className="round-btn spacer" />
            <span className="edit-label">connected</span>
            <input name="connected_on" type="date" defaultValue={v('connected_on')} aria-label="Connected on" className="edit-input" />
          </div>
          <div className="edit-row">
            <span className="round-btn spacer" />
            <span className="edit-label">contacted</span>
            <input name="last_contacted" type="date" defaultValue={v('last_contacted')} aria-label="Last contacted" className="edit-input" />
          </div>
        </div>
        <div className="field-group">
          <div className="edit-row edit-row-note">
            <span className="round-btn spacer" />
            <span className="edit-label">note</span>
            <textarea name="notes" defaultValue={v('notes')} placeholder="Note" aria-label="Note" rows={4} className="edit-input edit-note" />
          </div>
        </div>
      </div>
    </form>
  );
}
