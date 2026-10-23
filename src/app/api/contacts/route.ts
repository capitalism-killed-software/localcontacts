import { listContacts, sourceCounts } from '@/lib/contacts';
import { listArgs, parseBook } from '@/lib/context';
import { buildNamesPayload } from '@/lib/names-payload';

export const dynamic = 'force-dynamic';

// The names list for the book's current search, group and sort. Fetched by
// the client once per change of those, not on every card click.
export async function GET(req: Request) {
  const knownTags = new Set(sourceCounts().tags.map((t) => t.tag));
  const p = parseBook(new URL(req.url).searchParams, { knownTags });
  const { sort, dir } = listArgs(p);
  const rows = listContacts(p.q, p.filter, sort, dir, p.source, p.industry, { limit: null });
  return Response.json(buildNamesPayload(rows, p.viewSort), { headers: { 'Cache-Control': 'no-store' } });
}
