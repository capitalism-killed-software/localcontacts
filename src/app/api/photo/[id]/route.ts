import { getPhoto } from '@/lib/contacts';

export const dynamic = 'force-dynamic';

// A card's photo. The type was checked from the bytes when it was stored, and
// nosniff keeps the browser from second-guessing it.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  const photo = Number.isInteger(id) && id > 0 ? getPhoto(id) : null;
  if (!photo) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      'Content-Type': photo.type,
      'Cache-Control': 'private, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
