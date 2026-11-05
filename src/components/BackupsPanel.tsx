'use client';
import { useActionState } from 'react';
import { backupAction, type BackupResult } from '@/app/actions';

// The backups sheet: every copy of the book saved before an import, a
// clean-up or a restore, newest first, with what it was taken before.
// Restoring one saves the book as it is first, so it can always be undone.

export type BackupRow = { name: string; label: string; when: string; cards: number | null; size: string };
export type UndoImport = { name: string; files: string; when: string; changedSince: boolean };

const cardsText = (n: number) => `${n.toLocaleString()} card${n === 1 ? '' : 's'}`;

export default function BackupsPanel({
  rows,
  undo,
  total,
  folder,
}: {
  rows: BackupRow[];
  undo: UndoImport | null;
  total: string;
  folder: string | null;
}) {
  const [result, act, pending] = useActionState<BackupResult, FormData>(backupAction, null);

  const form = (op: 'restore' | 'undo' | 'delete', name: string, label: string, confirmText: string, primary = false) => (
    <form
      action={act}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="name" value={name} />
      <button type="submit" className={`btn${primary ? ' btn-done' : ''}`} disabled={pending}>
        {label}
      </button>
    </form>
  );

  return (
    <div className="card backups-panel">
      <h1 className="card-name">Backups</h1>
      <p className="card-company">
        A copy of the whole book is saved before every import, clean-up and restore. Restoring one saves the book as it
        is first, so you can always go back.
      </p>
      <hr className="card-divider" />

      {result && (
        <p className={`import-status backup-message ${result.ok ? 'is-ok' : 'is-bad'}`} role={result.ok ? 'status' : 'alert'}>
          {result.message}
        </p>
      )}

      {undo && (
        <div className="backup-undo">
          <p>
            Last import: <strong>{undo.files}</strong>, {undo.when}.
            {undo.changedSince && ' The book has changed since then: undoing the import also undoes those changes (the book as it is now is saved first).'}
          </p>
          {form(
            'undo',
            undo.name,
            undo.changedSince ? 'Undo it anyway…' : 'Undo this import…',
            undo.changedSince
              ? `Undo the import of ${undo.files}? Changes made since then are undone too; the book as it is now is saved first.`
              : `Undo the import of ${undo.files}?`,
            true
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="drop-sub">No backups yet. One is made before the first import that changes something.</p>
      ) : (
        <ul className="backup-list">
          {rows.map((b) => (
            <li key={b.name} className="backup-row">
              <div className="backup-text">
                <span className="backup-label">{b.label}</span>
                <span className="drop-sub">
                  {b.when}
                  {b.cards !== null && ` · ${cardsText(b.cards)}`} · {b.size}
                </span>
              </div>
              <div className="backup-actions">
                {form('restore', b.name, 'Restore', `Put the book back as it was on ${b.when}? The book as it is now is saved first.`)}
                {form('delete', b.name, 'Delete', `Delete the backup from ${b.when}? This cannot be undone.`)}
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <p className="drop-sub">
          {rows.length.toLocaleString()} backup{rows.length === 1 ? '' : 's'}, {total} in all
          {folder && (
            <>
              , in <code>{folder}</code>
            </>
          )}
          .
        </p>
      )}
    </div>
  );
}
