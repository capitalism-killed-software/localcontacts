'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createContact, updateContact, deleteContact, type ContactInput } from '@/lib/contacts';

function readForm(fd: FormData): ContactInput {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === 'string' ? v : null;
  };
  return {
    full_name: (s('full_name') ?? '').trim(),
    title: s('title'),
    company: s('company'),
    email: s('email'),
    phone: s('phone'),
    notes: s('notes'),
    connected_on: s('connected_on'),
    last_contacted: s('last_contacted'),
    industry: s('industry'),
  };
}

export async function createContactAction(fd: FormData) {
  const input = readForm(fd);
  if (!input.full_name) {
    throw new Error('Full name is required');
  }
  const c = createContact(input);
  revalidatePath('/');
  redirect(`/contacts/${c.id}`);
}

export async function updateContactAction(id: number, fd: FormData) {
  const input = readForm(fd);
  if (!input.full_name) {
    throw new Error('Full name is required');
  }
  updateContact(id, input);
  revalidatePath('/');
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}`);
}

export async function deleteContactAction(id: number) {
  deleteContact(id);
  revalidatePath('/');
  redirect('/');
}
