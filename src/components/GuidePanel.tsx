'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Service } from '@/lib/import/services';
import { slotWarning } from '@/lib/import/services';
import { useImportRun } from './useImportRun';

// The guided import: pick the services you use; each one shows its export
// steps (from the export guide), a link to the vendor, and a drop slot that
// imports its file into that service's group. A slot is ticked when the book
// has cards from that service, so the checklist can be left and picked up
// again; only the choice of services is remembered, in this browser.

export type GuideService = Service & { html: string; count: number };

const STORE = 'localcontacts:guide-services';

const cards = (n: number) => `${n.toLocaleString()} card${n === 1 ? '' : 's'}`;

export default function GuidePanel({ services, importHref, tidyHref }: { services: GuideService[]; importHref: string; tidyHref: string }) {
  // Services with cards in the book are chosen already; the rest come from this browser's memory.
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(services.filter((s) => s.count > 0).map((s) => s.id)));
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? '[]') as string[];
      if (saved.length) setChosen((c) => new Set([...c, ...saved]));
    } catch {
      // nothing saved, or not readable: start from the book
    }
  }, []);
  const toggle = (id: string, on: boolean) => {
    setChosen((c) => {
      const next = new Set(c);
      if (on) next.add(id);
      else next.delete(id);
      try {
        localStorage.setItem(STORE, JSON.stringify([...next]));
      } catch {
        // private browsing: it just won't be remembered
      }
      return next;
    });
  };
  const picked = services.filter((s) => chosen.has(s.id));

  return (
    <div className="card guide-panel">
      <h1 className="card-name">Bring In Your Contacts</h1>
      <p className="card-company">
        Export your contacts from each service you use, then drop each file in its place below. Everything stays on this
        computer.
      </p>
      <hr className="card-divider" />

      <h2 className="guide-step">1. Which of these do you use?</h2>
      <ul className="guide-choices">
        {services.map((s) => (
          <li key={s.id}>
            <label>
              <input type="checkbox" checked={chosen.has(s.id)} onChange={(e) => toggle(s.id, e.target.checked)} /> {s.label}
            </label>
            {s.count > 0 && <span className="drop-sub"> · {cards(s.count)} here</span>}
          </li>
        ))}
      </ul>

      {picked.length > 0 && (
        <>
          <h2 className="guide-step">2. Export, then drop the file in</h2>
          {picked.map((s) => (
            <GuideSlot key={s.id} service={s} importHref={importHref} />
          ))}
          <h2 className="guide-step">3. When they are all in</h2>
          <p>
            <Link href={tidyHref} scroll={false} prefetch={false}>
              Look for duplicates and tidy names →
            </Link>
          </p>
        </>
      )}
      <p className="drop-sub">
        Have the files already?{' '}
        <Link href={importHref} scroll={false} prefetch={false}>
          Import them all at once
        </Link>
        .
      </p>
    </div>
  );
}

function GuideSlot({ service, importHref }: { service: GuideService; importHref: string }) {
  const run = useImportRun(() => ({ source: service.tag ?? '' }));
  const { files, phase, report, error, busy } = run;
  const done = service.count > 0 || phase === 'done';
  const st = report?.stats;
  const canImport = phase === 'checked' && report?.ok && st && (st.inserted > 0 || st.mergedIntoExisting > 0);

  return (
    <section className={`guide-slot${done ? ' is-done' : ''}`} data-service={service.id} aria-label={service.label}>
      <h3 className="guide-slot-title">
        <span className="guide-mark" aria-hidden="true">
          {done ? '✓' : '○'}
        </span>{' '}
        {service.label}
        {service.count > 0 && <span className="drop-sub"> · {cards(service.count)} in the book</span>}
      </h3>
      <p className="drop-sub">{service.hint}</p>
      <details open={!done && !service.noExport ? true : undefined}>
        <summary>{service.noExport ? 'Why, and what to do instead' : `How to export from ${service.label}`}</summary>
        <div className="help-body guide-steps" dangerouslySetInnerHTML={{ __html: service.html }} />
      </details>
      {service.exportUrl && (
        <p className="guide-link">
          <a href={service.exportUrl} target="_blank" rel="noreferrer noopener">
            {service.linkLabel ?? `Open ${service.label}`} ↗
          </a>
        </p>
      )}

      {!service.noExport && phase !== 'done' && (
        <label className="drop-zone guide-drop">
          <input
            type="file"
            multiple
            accept=".vcf,.vcard,.csv,.json,text/vcard,text/csv,application/json"
            className="visually-hidden"
            onChange={(e) => {
              run.add(e.target.files);
              e.target.value = '';
            }}
          />
          <span className="drop-title">Drop the file from {service.label} here</span>
          <span className="drop-sub">or click to choose it. Nothing is written until you press Import.</span>
        </label>
      )}

      {files.length > 0 && phase !== 'done' && (
        <ul className="import-files">
          {files.map((f, i) => {
            const r = report?.files[i];
            const warning = r?.ok ? slotWarning(service, r.format) : null;
            return (
              <li key={f.name + f.size} className={r ? (r.ok ? 'is-ok' : 'is-bad') : ''}>
                <span className="import-mark" aria-hidden="true">
                  {r ? (r.ok ? '✓' : '✗') : '…'}
                </span>
                <span className="import-name">{f.name}</span>
                <span className="import-meta">
                  {r?.ok ? `${r.label}, ${cards(r.count ?? 0)}` : (r?.error ?? '')}
                  {r && !r.ok && r.headers?.length ? (
                    <>
                      {' '}
                      <Link href={importHref} scroll={false} prefetch={false}>
                        Choose its columns in Import…
                      </Link>
                    </>
                  ) : null}
                </span>
                {!busy && (
                  <button type="button" className="photo-remove" onClick={() => run.remove(i)}>
                    Remove {f.name}
                  </button>
                )}
                {warning && <p className="import-status guide-warning">{warning}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {busy && <p className="import-status">{phase === 'checking' ? 'Reading the file…' : 'Importing…'}</p>}
      {error && (
        <p className="import-status is-bad" role="alert">
          {error}
        </p>
      )}
      {phase === 'checked' && report?.ok && !canImport && <p className="import-status">Everything in this file is already here.</p>}
      {canImport && (
        <p className="import-actions">
          <button type="button" className="btn btn-done" onClick={() => void run.send(files, true)}>
            Import {st!.inserted > 0 ? `${st!.inserted.toLocaleString()} new` : ''}
            {st!.inserted > 0 && st!.mergedIntoExisting > 0 ? ', ' : ''}
            {st!.mergedIntoExisting > 0 ? `update ${st!.mergedIntoExisting.toLocaleString()}` : ''}
          </button>
          <span className="drop-sub">A copy of the book is saved first.</span>
        </p>
      )}
      {phase === 'done' && report?.written && (
        <p className="import-status is-ok">
          Imported: {report.written.inserted.toLocaleString()} new, {report.written.updated.toLocaleString()} updated.{' '}
          <button type="button" className="photo-remove" onClick={run.reset}>
            Add another file
          </button>
        </p>
      )}
    </section>
  );
}
