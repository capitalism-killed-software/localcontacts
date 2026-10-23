import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="desk">
      <div className="help-sheet error-sheet">
        <h1 className="card-name">Nothing here</h1>
        <p>That page doesn’t exist.</p>
        <p className="import-actions">
          <Link href="/" className="btn btn-done">
            Back to Contacts
          </Link>
        </p>
      </div>
    </div>
  );
}
