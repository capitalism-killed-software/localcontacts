import Link from 'next/link';
import type { Metadata } from 'next';
import { exportGuide } from '@/lib/export-guide';
import { markdownToHtml } from '@/lib/markdown';

// The export guide from docs/, rendered when the app is built, so it works
// offline and needs no network to read.
export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Exporting your contacts · Contacts' };

export default function ExportHelp() {
  const md = exportGuide();
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
