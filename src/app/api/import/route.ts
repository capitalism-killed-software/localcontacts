import { cleanFieldMap } from '@/lib/import/fields';
import { runImport, type ImportFile } from '@/lib/import/run';

export const dynamic = 'force-dynamic';

const MAX_FILES = 50;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;

// Only this app's own pages may post here. The app has no login, so without
// this check any website open in the same browser could write to your
// contacts through localhost.
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return req.headers.get('sec-fetch-site') !== 'cross-site';
  try {
    return new URL(origin).host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host'));
  } catch {
    return false;
  }
}

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

// The import page's endpoint: files in, the same report the command line
// prints out. Nothing is written unless `apply` is "1".
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, 'Imports are only accepted from this app.');
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, 'Expected a form upload.');
  }
  const uploads = form.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
  if (uploads.length === 0) return fail(400, 'Choose at least one file.');
  if (uploads.length > MAX_FILES) return fail(400, `At most ${MAX_FILES} files at a time.`);
  const total = uploads.reduce((n, f) => n + f.size, 0);
  if (total > MAX_TOTAL_BYTES) return fail(413, 'The files add up to more than 100 MB.');

  const rawSource = String(form.get('source') ?? '').trim();
  if (rawSource && !/^[A-Za-z0-9_.-]{1,40}$/.test(rawSource)) {
    return fail(400, 'A source tag may only use letters, digits, dots, dashes and underscores.');
  }
  const files: ImportFile[] = [];
  for (const [i, f] of uploads.entries()) {
    // Column choices for a generic CSV, as JSON: { "full_name": "Person", ... }
    let map = null;
    const rawMap = form.get(`map:${i}`);
    if (typeof rawMap === 'string' && rawMap) {
      try {
        map = cleanFieldMap(JSON.parse(rawMap));
      } catch {
        return fail(400, `The column choices for ${f.name} could not be read.`);
      }
    }
    files.push({ name: f.name || 'upload', bytes: new Uint8Array(await f.arrayBuffer()), source: rawSource || null, map });
  }
  const report = runImport(files, { apply: form.get('apply') === '1' });
  return Response.json(report, { headers: { 'Cache-Control': 'no-store' } });
}
