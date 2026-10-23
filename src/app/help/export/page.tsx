import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Link from 'next/link';
import type { Metadata } from 'next';
import { markdownToHtml } from '@/lib/markdown';

// The export guide from docs/, rendered when the app is built, so it works
// offline and needs no network to read.
export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Exporting your contacts · Contacts' };

export default function ExportHelp() {
  const md = readFileSync(join(process.cwd(), 'docs', 'exporting-your-contacts.md'), 'utf-8');
  return (
    <div className="desk help-desk">
      <article className="help-sheet">
        <Link href="/" className="help-back">
          ‹ Back to Contacts
        </Link>
        <p className="help-note">
          In the app you don’t need the commands below: export the files, then press <strong>Import…</strong> under the
          groups and drop them in.
        </p>
        <div className="help-body" dangerouslySetInnerHTML={{ __html: markdownToHtml(md) }} />
      </article>
    </div>
  );
}
