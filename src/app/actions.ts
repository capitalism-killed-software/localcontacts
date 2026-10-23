'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createContact, updateContact, deleteContact, type ContactInput } from '@/lib/contacts';
import { bookHref, contextQs } from '@/lib/urls';

// Emails, phones and links come in as repeated fields in DOM order; the
// first non-empty one is the primary value, the rest go to the alt lists.
function readForm(fd: FormData): ContactInput {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === 'string' ? v : null;
  };
  const list = (k: string) =>
    fd
      .getAll(k)
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean);
  const emails = list('email');
  const phones = list('phone');
  const urls = list('url');
  return {
    full_name: (s('full_name') ?? '').trim(),
    title: s('title'),
    company: s('company'),
    industry: s('industry'),
    email: emails[0] ?? null,
    alt_emails: emails.slice(1).join('\n') || null,
    phone: phones[0] ?? null,
    alt_phones: phones.slice(1).join('\n') || null,
    urls: urls.join('\n') || null,
    notes: s('notes'),
    connected_on: s('connected_on'),
    last_contacted: s('last_contacted'),
  };
}

// The bound query string round-trips through the client, so it is
// re-sanitised before it becomes a redirect target.
const safeQs = (qs: string) => contextQs(new URLSearchParams(qs));

export async function createContactAction(qs: string, fd: FormData) {
  const input = readForm(fd);
  if (!input.full_name) throw new Error('Name is required');
  const c = createContact(input);
  revalidatePath('/');
  redirect(bookHref(safeQs(qs), { id: c.id }));
}

export async function updateContactAction(id: number, qs: string, fd: FormData) {
  const input = readForm(fd);
  if (!input.full_name) throw new Error('Name is required');
  updateContact(id, input);
  revalidatePath('/');
  redirect(bookHref(safeQs(qs), { id }));
}

export async function deleteContactAction(id: number, qs: string) {
  deleteContact(id);
  revalidatePath('/');
  redirect(bookHref(safeQs(qs)));
}
