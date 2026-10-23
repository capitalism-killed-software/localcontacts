import { getContact, getPhoto } from '@/lib/contacts';
import { attachmentHeader } from '@/lib/export/filename';
import { contactToVcard } from '@/lib/export/vcard';

export const dynamic = 'force-dynamic';

// One card as a .vcf download: the stand-in for Address Book's Share button.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  const contact = Number.isInteger(id) && id > 0 ? getContact(id) : null;
  if (!contact) return new Response('Not found', { status: 404 });
  const photo = contact.photo_type ? getPhoto(contact.id) : null;
  return new Response(contactToVcard(contact, photo), {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': attachmentHeader(contact.full_name, contact.id, 'vcf'),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
