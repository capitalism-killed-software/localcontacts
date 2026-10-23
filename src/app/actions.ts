'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createContact, updateContact, deleteContact, setPhoto, type ContactInput } from '@/lib/contacts';
import { photoFromBytes } from '@/lib/photo';
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

// The photo field: a new image replaces the stored one, "remove" clears it,
// neither leaves it alone. Checked by its bytes, whatever the browser said.
async function applyPhoto(id: number, fd: FormData) {
  const file = fd.get('photo');
  if (file instanceof File && file.size > 0) {
    const r = photoFromBytes(new Uint8Array(await file.arrayBuffer()));
    if ('error' in r) {
      throw new Error(r.error === 'too-large' ? 'The photo is larger than 2 MB.' : 'The photo must be a JPEG, PNG, GIF or WebP image.');
    }
    setPhoto(id, r.photo);
  } else if (fd.get('remove_photo') === '1') {
    setPhoto(id, null);
  }
}

// The bound query string round-trips through the client, so it is
// re-sanitised before it becomes a redirect target.
const safeQs = (qs: string) => contextQs(new URLSearchParams(qs));

export async function createContactAction(qs: string, fd: FormData) {
  const input = readForm(fd);
  if (!input.full_name) throw new Error('Name is required');
  const c = createContact(input);
  await applyPhoto(c.id, fd);
  revalidatePath('/');
  redirect(bookHref(safeQs(qs), { id: c.id }));
}

export async function updateContactAction(id: number, qs: string, fd: FormData) {
  const input = readForm(fd);
  if (!input.full_name) throw new Error('Name is required');
  updateContact(id, input);
  await applyPhoto(id, fd);
  revalidatePath('/');
  redirect(bookHref(safeQs(qs), { id }));
}

export async function deleteContactAction(id: number, qs: string) {
  deleteContact(id);
  revalidatePath('/');
  redirect(bookHref(safeQs(qs)));
}
