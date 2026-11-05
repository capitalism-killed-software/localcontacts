'use client';
import { useState } from 'react';
import { isNewer, RELEASES_API, RELEASES_PAGE } from '@/lib/version';

// About localcontacts: what it promises, where the data is, and the one thing
// it will ever ask the internet: whether there is a newer release, when the
// button is pressed (never by itself).

type Check = { state: 'idle' | 'asking' } | { state: 'latest' } | { state: 'newer'; version: string; url: string } | { state: 'failed' };

export default function AboutPanel({ version, database, backups }: { version: string; database: string; backups: string | null }) {
  const [check, setCheck] = useState<Check>({ state: 'idle' });

  async function checkForUpdates() {
    setCheck({ state: 'asking' });
    try {
      const res = await fetch(RELEASES_API, {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { tag_name?: string; html_url?: string };
      const latest = body.tag_name ?? '';
      const url = body.html_url?.startsWith(`${RELEASES_PAGE}/`) ? body.html_url : RELEASES_PAGE;
      setCheck(isNewer(latest, version) ? { state: 'newer', version: latest.replace(/^v/, ''), url } : { state: 'latest' });
    } catch {
      setCheck({ state: 'failed' });
    }
  }

  return (
    <div className="card about-panel">
      <h1 className="card-name">localcontacts {version}</h1>
      <p className="card-company">
        An address book that lives on this computer. Open source (MIT), by Capitalism Killed Software.
      </p>
      <hr className="card-divider" />

      <ul className="about-promises">
        <li>
          <strong>Nothing leaves this computer.</strong> No account, no sync, no tracking. The only thing it ever asks the
          internet is the update check below, and only when you press it.
        </li>
        <li>
          <strong>No AI touches your contacts.</strong> Suggested industries come from a list of keywords anyone can read.
        </li>
        <li>
          <strong>The file is yours.</strong> Your contacts are one file you can copy, back up or delete:{' '}
          <code>{database}</code>
          {backups && (
            <>
              , with backups in <code>{backups}</code>
            </>
          )}
          .
        </li>
        <li>
          <strong>Nothing is lost.</strong> Imports keep every email, phone and link, and every change in bulk can be undone
          from Backups.
        </li>
      </ul>

      <h2 className="guide-step">Updates</h2>
      <p className="import-actions">
        <button type="button" className="btn" onClick={() => void checkForUpdates()} disabled={check.state === 'asking'}>
          Check for updates
        </button>
      </p>
      <p className="drop-sub">
        This asks GitHub for the number of the latest release. GitHub sees this computer’s internet address, as any website
        would, and nothing else: none of your contacts.
      </p>
      <div className="update-result" role="status">
        {check.state === 'asking' && <p className="import-status">Asking GitHub…</p>}
        {check.state === 'latest' && <p className="import-status is-ok">You have the latest version ({version}).</p>}
        {check.state === 'newer' && (
          <p className="import-status is-ok">
            localcontacts {check.version} is out.{' '}
            <a href={check.url} target="_blank" rel="noreferrer noopener">
              What’s new, and how to update ↗
            </a>
          </p>
        )}
        {check.state === 'failed' && (
          <p className="import-status is-bad">
            GitHub could not be reached. Check the connection, or look at{' '}
            <a href={RELEASES_PAGE} target="_blank" rel="noreferrer noopener">
              the releases page ↗
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
