'use client';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { backupAction, tidyAction, type BackupResult, type TidyResult } from '@/app/actions';
import type { CardSide, TidyData, TidyTab } from '@/lib/cleanup/sheet';

// Clean-up: possible duplicates side by side, names that are an email address,
// and suggested industries. Nothing changes until Apply, each Apply saves a
// backup first, and Undo puts it back.

const TAB_LABELS: Record<TidyTab, string> = { dupes: 'Duplicates', names: 'Names', industries: 'Industries' };

export default function TidyPanel({ data, hrefFor }: { data: TidyData; hrefFor: Record<string, string> }) {
  const [result, apply, applying] = useActionState<TidyResult, FormData>(tidyAction, null);
  const [undone, undo, undoing] = useActionState<BackupResult, FormData>(backupAction, null);
  // A new Apply hides the last Undo's message, and the other way round.
  const [shown, setShown] = useState<'result' | 'undo' | null>(null);
  useEffect(() => setShown(result ? 'result' : null), [result]);
  useEffect(() => setShown(undone ? 'undo' : null), [undone]);
  const busy = applying || undoing;

  return (
    <div className="card tidy-panel">
      <h1 className="card-name">Clean Up</h1>
      <p className="card-company">
        Suggestions only: nothing changes until you press Apply, and a copy of the book is saved first.
      </p>
      <nav className="tidy-tabs" aria-label="Clean-up">
        {(Object.keys(TAB_LABELS) as TidyTab[]).map((t) => (
          <Link
            key={t}
            href={hrefFor[`tab:${t}`]}
            scroll={false}
            prefetch={false}
            className={`tidy-tab${t === data.tab ? ' is-active' : ''}`}
            aria-current={t === data.tab ? 'page' : undefined}
          >
            {TAB_LABELS[t]} ({data.counts[t].toLocaleString()})
          </Link>
        ))}
      </nav>
      <hr className="card-divider" />

      {shown === 'result' && result && (
        <div className={`import-status tidy-message ${result.ok ? 'is-ok' : 'is-bad'}`} role={result.ok ? 'status' : 'alert'}>
          <span>{result.message}</span>
          {result.ok && result.backup && (
            <form action={undo}>
              <input type="hidden" name="op" value="undo" />
              <input type="hidden" name="name" value={result.backup} />
              <button type="submit" className="btn" disabled={busy}>
                Undo
              </button>
            </form>
          )}
        </div>
      )}
      {shown === 'undo' && undone && (
        <p className={`import-status tidy-message ${undone.ok ? 'is-ok' : 'is-bad'}`} role={undone.ok ? 'status' : 'alert'}>
          {undone.message}
        </p>
      )}

      <form action={apply} key={`${data.tab}:${data.page}:${data.counts[data.tab]}`}>
        <input type="hidden" name="op" value={data.tab} />
        {data.tab === 'dupes' && <Duplicates data={data} />}
        {data.tab === 'names' && <Names data={data} />}
        {data.tab === 'industries' && <Industries data={data} />}
        {data.counts[data.tab] > 0 && (
          <p className="import-actions">
            <button type="submit" className="btn btn-done" disabled={busy}>
              Apply
            </button>
            <span className="drop-sub">A copy of the book is saved first.</span>
          </p>
        )}
      </form>

      {data.pages > 1 && (
        <p className="tidy-pages drop-sub">
          {data.page > 1 && (
            <Link href={hrefFor[`page:${data.page - 1}`]} scroll={false} prefetch={false}>
              ‹ Previous
            </Link>
          )}{' '}
          Page {data.page} of {data.pages}{' '}
          {data.page < data.pages && (
            <Link href={hrefFor[`page:${data.page + 1}`]} scroll={false} prefetch={false}>
              Next ›
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

function Duplicates({ data }: { data: TidyData }) {
  return (
    <>
      {data.pairs.length === 0 ? (
        <p className="drop-sub">No possible duplicates.</p>
      ) : (
        <p className="drop-sub">
          Choose which card to keep: the other one is merged into it, and nothing on it is lost (values that differ go
          into the note). Pairs you leave on “Decide later” stay here.
        </p>
      )}
      {data.largeGroups.length > 0 && (
        <p className="drop-sub">
          Not shown: {data.largeGroups.length === 1 ? 'a group' : `${data.largeGroups.length} groups`} of more than ten cards
          sharing a name, email or phone (for example an office number). Search for it to look at those cards.
        </p>
      )}
      {data.pairs.map((p) => {
        const field = `pair:${p.a.id}:${p.b.id}`;
        const choice = (value: string, label: string) => (
          <label className="dupe-choice">
            <input type="radio" name={field} value={value} defaultChecked={value === ''} /> {label}
          </label>
        );
        return (
          <fieldset key={field} className="dupe-pair">
            <legend className="dupe-why">{p.why}</legend>
            <table className="dupe-table">
              <tbody>
                <tr>
                  <th scope="row">name</th>
                  <td className="dupe-side-name">{p.a.name || '(no name)'}</td>
                  <td className="dupe-side-name">{p.b.name || '(no name)'}</td>
                </tr>
                <Row label="email" a={p.a.emails.join(', ')} b={p.b.emails.join(', ')} />
                <Row label="phone" a={p.a.phones.join(', ')} b={p.b.phones.join(', ')} />
                <Row label="company" a={p.a.company} b={p.b.company} />
                <Row label="title" a={p.a.title} b={p.b.title} />
                <Row label="industry" a={p.a.industry} b={p.b.industry} />
                <Row label="groups" a={p.a.groups} b={p.b.groups} />
                <Row label="note" a={p.a.note} b={p.b.note} />
                <Row label="photo" a={p.a.photo ? 'yes' : null} b={p.b.photo ? 'yes' : null} />
              </tbody>
            </table>
            <div className="dupe-choices">
              {choice('a', 'Keep left')}
              {choice('b', 'Keep right')}
              {choice('apart', 'Not the same person')}
              {choice('', 'Decide later')}
            </div>
          </fieldset>
        );
      })}
    </>
  );
}

function Row({ label, a, b }: { label: string; a: CardSide[keyof CardSide] | null; b: CardSide[keyof CardSide] | null }) {
  if (!a && !b) return null;
  const same = String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
  return (
    <tr className={same ? 'is-same' : 'is-different'}>
      <th scope="row">{label}</th>
      <td>{a || '—'}</td>
      <td>{b || '—'}</td>
    </tr>
  );
}

function Names({ data }: { data: TidyData }) {
  if (data.names.length === 0) return <p className="drop-sub">No names to tidy.</p>;
  return (
    <>
      <p className="drop-sub">Names that are an email address or are wrapped around one. An address found only in the name is kept as an email.</p>
      <ul className="tidy-list">
        {data.names.map((n) => (
          <li key={n.id} className="tidy-row">
            <label>
              <input type="checkbox" name="id" value={n.id} defaultChecked /> <span className="tidy-from">{n.from}</span> →{' '}
              <strong>{n.to}</strong>
              {(n.addEmails.length > 0 || n.company) && (
                <span className="drop-sub">
                  {' '}
                  ({[n.addEmails.length ? `keeps ${n.addEmails.join(', ')} as an email` : '', n.company ? `company: ${n.company}` : ''].filter(Boolean).join('; ')})
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}

function Industries({ data }: { data: TidyData }) {
  if (data.industries.length === 0) return <p className="drop-sub">No industries to suggest.</p>;
  return (
    <>
      <p className="drop-sub">
        Suggested from the company and job title by a fixed list of keywords, only for cards without an industry. Untick any
        that are wrong.
      </p>
      <ul className="tidy-list">
        {data.industries.map((p) => (
          <li key={p.id} className="tidy-row">
            <label>
              <input type="checkbox" name="id" value={p.id} defaultChecked /> {p.name}
              <span className="drop-sub"> · {[p.company, p.title].filter(Boolean).join(', ')}</span> → <strong>{p.industry}</strong>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
