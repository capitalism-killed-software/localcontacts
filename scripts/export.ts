/**
 * Export contacts as vCard or CSV.
 *
 * Usage:
 *   npm run export -- --format=vcard|csv [--out=<file>] [--force] [--excel]
 *                     [--q=<text>] [--filter=<key>] [--source=<tag>] [--industry=<name>] [--sort=<order>]
 *
 * Writes to stdout unless --out is given; refuses to overwrite a file without
 * --force. The filters are the ones the book uses (the same names as its URL
 * parameters), with no 500-row cap. --excel puts a ' before CSV cells that a
 * spreadsheet would run as formulas, as the export sheet in the book does (the
 * importer takes it off again). A one-line summary goes to stderr.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseBook } from '../src/lib/context';
import { exportBook } from '../src/lib/export/book';

const USAGE =
  'Usage: npm run export -- --format=vcard|csv [--out=<file>] [--force] [--excel] [--q=] [--filter=] [--source=] [--industry=] [--sort=]';
const FILTER_OPTIONS = ['q', 'filter', 'source', 'industry', 'sort'];

function fail(msg: string): never {
  console.error(`${msg}\n${USAGE}`);
  process.exit(1);
}

function main() {
  let format: 'vcard' | 'csv' | null = null;
  let out: string | null = null;
  let force = false;
  let excel = false;
  const params = new URLSearchParams();
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([a-z]+)(?:=(.*))?$/);
    if (!m) fail(`Unexpected argument ${a}`);
    const [, key, value = ''] = m;
    if (key === 'format') {
      if (value !== 'vcard' && value !== 'csv') fail(`--format must be vcard or csv`);
      format = value;
    } else if (key === 'out') out = resolve(value.replace(/^~(?=[/\\]|$)/, process.env.HOME ?? process.env.USERPROFILE ?? '~'));
    else if (key === 'force') force = true;
    else if (key === 'excel') excel = true;
    else if (key === 'help') {
      console.log(USAGE);
      return;
    } else if (FILTER_OPTIONS.includes(key)) params.set(key, value);
    else fail(`Unknown option --${key}`);
  }
  if (!format) fail('--format is required');

  const p = parseBook(params);
  if (params.get('filter') && p.filter === 'all' && params.get('filter') !== 'all') fail(`Unknown filter ${params.get('filter')}`);
  const { count, text } = exportBook(params, format, { bom: out !== null, excel });
  const label = format === 'vcard' ? 'vCard 3.0' : 'CSV';
  if (out) {
    if (existsSync(out) && !force) fail(`${out} exists; pass --force to overwrite it`);
    try {
      writeFileSync(out, text, 'utf-8');
    } catch (err) {
      const code = (err as { code?: string }).code;
      fail(code === 'ENOENT' ? `cannot write ${out}: its folder does not exist` : `cannot write ${out}: ${(err as Error).message}`);
    }
    console.error(`Exported ${count.toLocaleString()} cards (${label}) to ${out}`);
  } else {
    process.stdout.write(text);
    console.error(`Exported ${count.toLocaleString()} cards (${label})`);
  }
}

main();
