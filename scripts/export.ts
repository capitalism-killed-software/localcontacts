/**
 * Export contacts as vCard or CSV.
 *
 * Usage:
 *   npm run export -- --format=vcard|csv [--out=<file>] [--force]
 *                     [--q=<text>] [--filter=<key>] [--source=<tag>] [--industry=<name>] [--sort=<order>]
 *
 * Writes to stdout unless --out is given; refuses to overwrite a file without
 * --force. The filters are the ones the book uses (the same names as its URL
 * parameters), with no 500-row cap. A one-line summary goes to stderr.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPhoto, listContacts } from '../src/lib/contacts';
import { listArgs, parseBook } from '../src/lib/context';
import { contactsToCsv } from '../src/lib/export/csv';
import { contactsToVcf } from '../src/lib/export/vcard';
import { sectionize } from '../src/lib/names';

const USAGE =
  'Usage: npm run export -- --format=vcard|csv [--out=<file>] [--force] [--q=] [--filter=] [--source=] [--industry=] [--sort=]';
const FILTER_OPTIONS = ['q', 'filter', 'source', 'industry', 'sort'];

function fail(msg: string): never {
  console.error(`${msg}\n${USAGE}`);
  process.exit(1);
}

function main() {
  let format: 'vcard' | 'csv' | null = null;
  let out: string | null = null;
  let force = false;
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
    else if (key === 'help') {
      console.log(USAGE);
      return;
    } else if (FILTER_OPTIONS.includes(key)) params.set(key, value);
    else fail(`Unknown option --${key}`);
  }
  if (!format) fail('--format is required');

  const p = parseBook(params);
  if (params.get('filter') && p.filter === 'all' && params.get('filter') !== 'all') fail(`Unknown filter ${params.get('filter')}`);
  const { sort, dir } = listArgs(p);
  let rows = listContacts(p.q, p.filter, sort, dir, p.source, p.industry, { limit: null });
  if (p.viewSort === 'last') rows = sectionize(rows, 'last').flatMap((s) => s.items.map((i) => i.contact));

  const text =
    format === 'vcard'
      ? contactsToVcf(rows, (c) => (c.photo_type ? getPhoto(c.id) : null))
      : contactsToCsv(rows, { bom: out !== null });
  const label = format === 'vcard' ? 'vCard 3.0' : 'CSV';
  if (out) {
    if (existsSync(out) && !force) fail(`${out} exists; pass --force to overwrite it`);
    try {
      writeFileSync(out, text, 'utf-8');
    } catch (err) {
      const code = (err as { code?: string }).code;
      fail(code === 'ENOENT' ? `cannot write ${out}: its folder does not exist` : `cannot write ${out}: ${(err as Error).message}`);
    }
    console.error(`Exported ${rows.length.toLocaleString()} cards (${label}) to ${out}`);
  } else {
    process.stdout.write(text);
    console.error(`Exported ${rows.length.toLocaleString()} cards (${label})`);
  }
}

main();
