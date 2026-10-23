'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { FIELD_LABELS, MAPPABLE, type FieldMap, type MappableField } from '@/lib/import/fields';
import type { ImportReport } from '@/lib/import/run';

// The import sheet on the right page: choose or drop export files, see what
// the importer makes of them (a dry run, nothing written), then import.

type Phase = 'idle' | 'checking' | 'checked' | 'importing' | 'done' | 'error';

const keyOf = (f: File) => `${f.name}:${f.size}`;

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export default function ImportPanel({ doneHref }: { doneHref: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [source, setSource] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Column choices for generic CSVs, by file; and which files show them.
  const [maps, setMaps] = useState<Record<string, FieldMap>>({});
  const [mapOpen, setMapOpen] = useState<Record<string, boolean>>({});

  async function send(list: File[], apply: boolean, mapsNow: Record<string, FieldMap> = maps) {
    setError(null);
    setPhase(apply ? 'importing' : 'checking');
    const form = new FormData();
    list.forEach((f, i) => {
      form.append('file', f, f.name);
      const m = mapsNow[keyOf(f)];
      if (m && Object.keys(m).length) form.append(`map:${i}`, JSON.stringify(m));
    });
    if (source.trim()) form.append('source', source.trim());
    if (apply) form.append('apply', '1');
    try {
      const res = await fetch('/api/import', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Import failed (${res.status})`);
      setReport(body as ImportReport);
      // Open the column choices for any CSV whose name column couldn't be guessed.
      const r = body as ImportReport;
      setMapOpen((open) => {
        const next = { ...open };
        r.files.forEach((fr, i) => {
          if (!fr.ok && fr.headers?.length && list[i]) next[keyOf(list[i])] = true;
        });
        return next;
      });
      if (apply && (body as ImportReport).applied) {
        setPhase('done');
        router.refresh();
      } else setPhase('checked');
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  }

  function add(chosen: FileList | null) {
    if (!chosen || chosen.length === 0) return;
    const names = new Set(files.map((f) => f.name + f.size));
    const next = [...files, ...Array.from(chosen).filter((f) => !names.has(f.name + f.size))];
    setFiles(next);
    if (input.current) input.current.value = '';
    void send(next, false);
  }

  function remove(i: number) {
    const next = files.filter((_, j) => j !== i);
    setFiles(next);
    setReport(null);
    if (next.length) void send(next, false);
    else setPhase('idle');
  }

  function setColumn(f: File, field: MappableField, column: string) {
    const k = keyOf(f);
    const m = { ...(maps[k] ?? {}) };
    if (column) m[field] = column;
    else delete m[field];
    const next = { ...maps, [k]: m };
    setMaps(next);
    void send(files, false, next);
  }

  const st = report?.stats;
  const busy = phase === 'checking' || phase === 'importing';
  const canImport = phase === 'checked' && report?.ok && st && (st.inserted > 0 || st.mergedIntoExisting > 0);

  return (
    <div className="card import-panel">
      <h1 className="card-name">Import Contacts</h1>
      <p className="card-company">
        vCard (Apple, Google, Proton, Android, Outlook), Google or Outlook CSV, LinkedIn Connections.csv, Telegram
        result.json, or any CSV with a header row.{' '}
        <a href="/help/export" target="_blank" rel="noreferrer">
          How to export them
        </a>
      </p>
      <hr className="card-divider" />

      {phase !== 'done' && (
        <label
          className={`drop-zone${dragging ? ' is-dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            add(e.dataTransfer.files);
          }}
        >
          <input
            ref={input}
            type="file"
            multiple
            accept=".vcf,.vcard,.csv,.json,text/vcard,text/csv,application/json"
            className="visually-hidden"
            onChange={(e) => add(e.target.files)}
          />
          <span className="drop-title">Drop export files here</span>
          <span className="drop-sub">or click to choose them. Nothing is written until you press Import.</span>
        </label>
      )}

      {files.length > 0 && phase !== 'done' && (
        <div className="import-source">
          <label htmlFor="import-source" className="field-label">
            tag
          </label>
          <input
            id="import-source"
            className="boxed-input"
            placeholder="optional, e.g. work-phone (otherwise taken from each file)"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onBlur={() => files.length && void send(files, false)}
          />
        </div>
      )}

      {files.length > 0 && (
        <ul className="import-files">
          {files.map((f, i) => {
            const r = report?.files[i];
            return (
              <li key={f.name + f.size} className={r ? (r.ok ? 'is-ok' : 'is-bad') : ''}>
                <span className="import-mark" aria-hidden="true">
                  {r ? (r.ok ? '✓' : '✗') : '…'}
                </span>
                <span className="import-name">{f.name}</span>
                <span className="import-meta">
                  {r?.ok
                    ? `${r.label}, ${r.count} contacts, tagged “${r.source}”`
                    : r?.headers?.length && /name column/.test(r.error ?? '')
                      ? 'No name column found. Choose which column holds the name, below.'
                      : r?.error ?? kb(f.size)}
                </span>
                {phase !== 'done' && !busy && (
                  <button type="button" className="photo-remove" onClick={() => remove(i)} aria-label={`Remove ${f.name}`}>
                    remove
                  </button>
                )}
                {r?.headers && r.headers.length > 0 && phase !== 'done' && !mapOpen[keyOf(f)] && (
                  <button type="button" className="photo-remove" onClick={() => setMapOpen({ ...mapOpen, [keyOf(f)]: true })}>
                    columns
                  </button>
                )}
                {r?.headers && r.headers.length > 0 && phase !== 'done' && mapOpen[keyOf(f)] && (
                  <div className="import-map">
                    <p className="drop-sub">Which column holds what? Leave a field on “guess” to let the importer decide.</p>
                    {MAPPABLE.map((field) => (
                      <label key={field} className="import-map-row">
                        <span className="field-label">{FIELD_LABELS[field]}</span>
                        <select
                          className="sort-select"
                          value={maps[keyOf(f)]?.[field] ?? ''}
                          disabled={busy}
                          onChange={(e) => setColumn(f, field, e.target.value)}
                        >
                          <option value="">guess</option>
                          {r.headers!.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
                {r?.ok && r.warnings.length > 0 && (
                  <ul className="import-notes">
                    {r.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {busy && <p className="import-status">{phase === 'checking' ? 'Reading the files…' : 'Importing…'}</p>}
      {error && (
        <p className="import-status is-bad" role="alert">
          {error}
        </p>
      )}
      {report && !report.ok && phase !== 'checking' && (
        <p className="import-status is-bad">Nothing can be imported until every file is readable. Choose columns for the ones marked ✗, or remove them.</p>
      )}

      {st && report?.ok && (
        <dl className="card-fields import-summary">
          <div className="field-group">
            <Row label="new" value={st.inserted} />
            <Row label="merged" value={st.mergedIntoExisting} />
            <Row label="emails" value={`${st.addedEmails} added`} />
            <Row label="phones" value={`${st.addedPhones} added`} />
            <Row label="photos" value={`${st.addedPhotos} added`} />
            <Row label="cards" value={`${report.before.toLocaleString()} → ${report.after.toLocaleString()}`} />
          </div>
        </dl>
      )}

      {phase === 'checked' && report?.ok && !canImport && <p className="import-status">Everything in these files is already here.</p>}

      {canImport && (
        <p className="import-actions">
          <button type="button" className="btn btn-done" onClick={() => send(files, true)}>
            Import {st!.inserted > 0 ? `${st!.inserted.toLocaleString()} new` : ''}
            {st!.inserted > 0 && st!.mergedIntoExisting > 0 ? ', ' : ''}
            {st!.mergedIntoExisting > 0 ? `update ${st!.mergedIntoExisting.toLocaleString()}` : ''}
          </button>
          <span className="drop-sub">A copy of your database is saved to data/backups first.</span>
        </p>
      )}

      {phase === 'done' && report?.written && (
        <div className="import-done">
          <p className="import-status is-ok">
            Imported: {report.written.inserted} new, {report.written.updated} updated.
          </p>
          {report.backup && <p className="drop-sub">Backup: {report.backup}</p>}
          <p className="import-actions">
            <Link href={doneHref} scroll={false} className="btn btn-done">
              Done
            </Link>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setFiles([]);
                setMaps({});
                setMapOpen({});
                setReport(null);
                setPhase('idle');
              }}
            >
              Import more
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="field-row">
      <dt className="field-label">{label}</dt>
      <dd className="field-value">{typeof value === 'number' ? value.toLocaleString() : value}</dd>
    </div>
  );
}
