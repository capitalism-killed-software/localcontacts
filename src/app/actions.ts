'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createContact, updateContact, deleteContact, setPhoto, type ContactInput } from '@/lib/contacts';
import { photoFromBytes } from '@/lib/photo';
import { cleanIndustry, dedupeEmails, dedupePhones, defaultCountry } from '@/lib/import/normalize';
import { deleteBackup, describeBackup, formatWhen, listBackups, restoreBackup } from '@/lib/backups';
import { applyDuplicates, bookDuplicates, pairKey } from '@/lib/cleanup/dupes';
import { applyNameFixes } from '@/lib/cleanup/names';
import { applyIndustries } from '@/lib/industry';
import type { Pair } from '@/lib/import/dupes';
import { loadSamplePeople, removeSamplePeople } from '@/lib/sample';
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
  // The same address in another case, or the same number in another format, is kept once.
  const emails = dedupeEmails(list('email'));
  const phones = dedupePhones(list('phone'), defaultCountry());
  const urls = list('url');
  return {
    full_name: (s('full_name') ?? '').trim(),
    title: s('title'),
    company: s('company'),
    industry: cleanIndustry(s('industry')),
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
      throw new Error(
        r.error === 'too-large'
          ? 'The photo is larger than 2 MB.'
          : r.error === 'damaged'
            ? 'The photo file is damaged or cut off.'
            : 'The photo must be a JPEG, PNG, GIF or WebP image.'
      );
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

// The first-run welcome's "Look around with sample people", and the banner's
// "Remove them". Both go back to the list.
export async function loadSampleAction(qs: string) {
  loadSamplePeople();
  revalidatePath('/');
  redirect(bookHref(safeQs(qs)));
}

export async function removeSampleAction(qs: string) {
  removeSamplePeople();
  revalidatePath('/');
  redirect(bookHref(safeQs(qs)));
}

// The backups sheet and the import's "Undo this import". The result is shown
// in the sheet (a thrown error would only reach the error page, without its
// message, in a production build).
export type BackupResult = { ok: boolean; message: string } | null;

export async function backupAction(_prev: BackupResult, fd: FormData): Promise<BackupResult> {
  const op = fd.get('op');
  const name = String(fd.get('name') ?? '');
  const entry = listBackups().find((b) => b.name === name);
  try {
    if (op === 'restore' || op === 'undo') {
      const { cards } = restoreBackup(name);
      revalidatePath('/');
      const n = `${cards.toLocaleString()} card${cards === 1 ? '' : 's'}`;
      if (op === 'undo') {
        const what = entry ? describeBackup(entry).replace(/^Before /, '') : 'that change';
        return { ok: true, message: `Undone. The book is back as it was before ${what} (${n}).` };
      }
      return {
        ok: true,
        message: `Restored the backup from ${entry ? formatWhen(entry.at) : name} (${n}). The book as it was just before is saved as the newest backup.`,
      };
    }
    if (op === 'delete') {
      deleteBackup(name);
      revalidatePath('/');
      return { ok: true, message: `Deleted the backup from ${entry ? formatWhen(entry.at) : name}.` };
    }
    return { ok: false, message: 'Nothing to do.' };
  } catch (err) {
    const label = entry ? describeBackup(entry).toLowerCase() : 'that backup';
    return { ok: false, message: `Nothing was changed: ${(err as Error).message} (${label})` };
  }
}

// Clean-up's Apply. The form sends ids and choices only; what to change is
// worked out again here, so a page left open while the book changed can't
// write a stale suggestion. Each Apply takes one backup, which Undo restores.
export type TidyResult = { ok: boolean; message: string; backup: string | null } | null;

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const fileName = (path: string | null) => path?.split(/[\\/]/).pop() ?? null;

export async function tidyAction(_prev: TidyResult, fd: FormData): Promise<TidyResult> {
  const op = fd.get('op');
  const ids = fd
    .getAll('id')
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
  try {
    if (op === 'names') {
      const { changed, backup } = applyNameFixes(ids);
      revalidatePath('/');
      return { ok: true, message: changed ? `Tidied ${plural(changed, 'name')}.` : 'Nothing changed.', backup: fileName(backup) };
    }
    if (op === 'industries') {
      const { changed, backup } = applyIndustries(ids);
      revalidatePath('/');
      return { ok: true, message: changed ? `Filled in ${plural(changed, 'industry', 'industries')}.` : 'Nothing changed.', backup: fileName(backup) };
    }
    if (op === 'dupes') {
      const current = new Set(bookDuplicates().pairs.map((p) => pairKey(p.a, p.b)));
      const merges: Pair[] = [];
      const dismiss: Pair[] = [];
      for (const [key, value] of fd.entries()) {
        const m = key.match(/^pair:(\d+):(\d+)$/);
        if (!m) continue;
        const a = Number(m[1]);
        const b = Number(m[2]);
        if (!current.has(pairKey(a, b))) continue;
        if (value === 'a') merges.push([a, b]);
        else if (value === 'b') merges.push([b, a]);
        else if (value === 'apart') dismiss.push([a, b]);
      }
      const r = applyDuplicates({ merges, dismiss });
      revalidatePath('/');
      const parts = [r.merged ? `Merged ${plural(r.merged, 'pair')}` : '', r.dismissed ? `Kept ${plural(r.dismissed, 'pair')} apart` : ''].filter(Boolean);
      return { ok: true, message: parts.length ? `${parts.join('; ')}.` : 'Nothing changed: choose what to do with a pair first.', backup: fileName(r.backup) };
    }
    return { ok: false, message: 'Nothing to do.', backup: null };
  } catch (err) {
    return { ok: false, message: `Nothing was changed: ${(err as Error).message}`, backup: null };
  }
}
