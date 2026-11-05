import { isReadFromApp } from '@/lib/hosts';
import { contactsToCsv } from '@/lib/export/csv';
import { bookRows, exportDisposition, isExportFormat, vcardChunks } from '@/lib/export/book';

export const dynamic = 'force-dynamic';

// The export sheet's downloads: what the book shows (its search, group and
// order), as vCard or as an Excel-safe CSV. Only for the app's own pages.
export async function GET(req: Request) {
  if (!isReadFromApp(req.headers)) return new Response('localcontacts only sends contacts to its own pages.\n', { status: 403 });
  const params = new URL(req.url).searchParams;
  const format = params.get('format');
  if (!isExportFormat(format)) return new Response('format must be vcard or csv\n', { status: 400 });

  const rows = bookRows(params);
  const headers = {
    'Content-Type': format === 'vcard' ? 'text/vcard; charset=utf-8' : 'text/csv; charset=utf-8',
    'Content-Disposition': exportDisposition(params, format),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (format === 'csv') return new Response(contactsToCsv(rows, { bom: true, excel: true }), { headers });

  // vCard with photos can be large: send it card by card.
  const cards = vcardChunks(rows);
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = cards.next();
      if (next.done) controller.close();
      else controller.enqueue(encoder.encode(next.value));
    },
  });
  return new Response(body, { headers });
}
