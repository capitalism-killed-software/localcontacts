import type { Contact } from '@/lib/contacts';

export default function ContactForm({
  contact,
  action,
  submitLabel,
}: {
  contact?: Contact;
  action: (fd: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  const f = (k: keyof Contact) => (contact?.[k] as string | null | undefined) ?? '';
  return (
    <form action={action} className="space-y-4">
      <Field label="Full name *" name="full_name" defaultValue={f('full_name')} required />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Title" name="title" defaultValue={f('title')} />
        <Field label="Company" name="company" defaultValue={f('company')} />
        <Field label="Industry" name="industry" defaultValue={f('industry')} />
        <Field label="Email" name="email" type="email" defaultValue={f('email')} />
        <Field label="Phone" name="phone" defaultValue={f('phone')} />
        <Field
          label="Connected on"
          name="connected_on"
          type="date"
          defaultValue={f('connected_on')}
        />
        <Field
          label="Last contacted"
          name="last_contacted"
          type="date"
          defaultValue={f('last_contacted')}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Notes</label>
        <textarea
          name="notes"
          rows={4}
          defaultValue={f('notes')}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-neutral-700">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
      />
    </div>
  );
}
