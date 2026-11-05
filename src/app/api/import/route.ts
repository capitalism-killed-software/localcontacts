import { isWriteFromApp } from '@/lib/hosts';
import { cleanFieldMap } from '@/lib/import/fields';
import { MAX_IMPORT_BYTES, MAX_IMPORT_FILES, TOO_LARGE_MESSAGE } from '@/lib/import/limits';
import { runImport, type ImportFile } from '@/lib/import/run';

export const dynamic = 'force-dynamic';

const TAG = /^[A-Za-z0-9_.-]+$/;

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

// The import page's endpoint: files in, the same report the command line
// prints out. Nothing is written unless `apply` is "1".
export async function POST(req: Request) {
  // Only this app's own pages may post here (src/proxy.ts checks this too). The app
  // has no login, so otherwise any website open in the same browser could write
  // to your contacts through localhost.
  if (!isWriteFromApp(req.headers, process.env.CONTACTS_ALLOWED_HOSTS)) {
    return fail(403, 'Imports are only accepted from this app.');
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, 'Expected a form upload.');
  }
  const uploads = form.getAll('file').filter((f): f is File => f instanceof File);
  if (uploads.length === 0) return fail(400, 'Choose at least one file.');
  const empty = uploads.find((f) => f.size === 0);
  if (empty) return fail(400, `${empty.name || 'One of the files'} is empty.`);
  if (uploads.length > MAX_IMPORT_FILES) return fail(400, `At most ${MAX_IMPORT_FILES} files at a time.`);
  const total = uploads.reduce((n, f) => n + f.size, 0);
  if (total > MAX_IMPORT_BYTES) return fail(413, TOO_LARGE_MESSAGE);

  const rawSource = String(form.get('source') ?? '').trim();
  if (rawSource.length > 40) return fail(400, 'A source tag can be at most 40 characters long.');
  if (rawSource && !TAG.test(rawSource)) {
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
