'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FieldMap, MappableField } from '@/lib/import/fields';
import type { ImportReport } from '@/lib/import/run';

// One run of the importer from the page: the chosen files, the dry run the
// server makes of them, then the import. Shared by the import sheet and the
// guided import's slots. `fields` adds form fields to every request (a tag,
// "remove the sample people").

export type Phase = 'idle' | 'checking' | 'checked' | 'importing' | 'done' | 'error';

export const keyOf = (f: File) => `${f.name}:${f.size}`;

export function useImportRun(fields: () => Record<string, string>) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Column choices for generic CSVs, by file; and which files show them.
  const [maps, setMaps] = useState<Record<string, FieldMap>>({});
  const [mapOpen, setMapOpen] = useState<Record<string, boolean>>({});

  async function send(list: File[], apply: boolean, opts: { maps?: Record<string, FieldMap>; fields?: Record<string, string> } = {}) {
    const mapsNow = opts.maps ?? maps;
    setError(null);
    setPhase(apply ? 'importing' : 'checking');
    const form = new FormData();
    list.forEach((f, i) => {
      form.append('file', f, f.name);
      const m = mapsNow[keyOf(f)];
      if (m && Object.keys(m).length) form.append(`map:${i}`, JSON.stringify(m));
    });
    for (const [k, v] of Object.entries(opts.fields ?? fields())) if (v) form.append(k, v);
    if (apply) form.append('apply', '1');
    try {
      const res = await fetch('/api/import', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Import failed (${res.status})`);
      const r = body as ImportReport;
      setReport(r);
      // Open the column choices for any CSV whose name column couldn't be guessed.
      setMapOpen((open) => {
        const next = { ...open };
        r.files.forEach((fr, i) => {
          if (!fr.ok && fr.headers?.length && list[i]) next[keyOf(list[i])] = true;
        });
        return next;
      });
      if (apply && r.applied) {
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
    const names = new Set(files.map(keyOf));
    const next = [...files, ...Array.from(chosen).filter((f) => !names.has(keyOf(f)))];
    setFiles(next);
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
    void send(files, false, { maps: next });
  }

  function reset() {
    setFiles([]);
    setMaps({});
    setMapOpen({});
    setReport(null);
    setError(null);
    setPhase('idle');
  }

  const busy = phase === 'checking' || phase === 'importing';
  return { files, phase, report, error, maps, mapOpen, setMapOpen, busy, send, add, remove, setColumn, reset };
}
