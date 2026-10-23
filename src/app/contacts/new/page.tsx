import ContactForm from '@/components/ContactForm';
import { createContactAction } from '@/app/actions';

export default function NewContactPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New contact</h1>
        <p className="text-sm text-neutral-500">Add a contact to your local database.</p>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <ContactForm action={createContactAction} submitLabel="Save contact" />
      </div>
    </div>
  );
}
