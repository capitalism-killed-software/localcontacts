'use client';
import Link from 'next/link';

// Shown when something goes wrong while loading or saving: a sheet on the
// desk with a way back, instead of the framework's default error page.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="desk">
      <div className="help-sheet error-sheet" role="alert">
        <h1 className="card-name">Something went wrong</h1>
        <p>
          The change may not have been saved. Your contacts are still in the database file (
          <code>data/contacts.db</code> unless <code>CONTACTS_DB_PATH</code> names another), and every import that changes
          something leaves a copy in the <code>backups</code> folder next to it.
        </p>
        {error.digest && <p className="drop-sub">Reference for the terminal log: {error.digest}</p>}
        <p className="import-actions">
          <button type="button" className="btn btn-done" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn">
            Back to Contacts
          </Link>
        </p>
      </div>
    </div>
  );
}
