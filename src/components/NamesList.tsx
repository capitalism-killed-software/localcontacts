'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { NamesPayload } from '@/lib/names-payload';
import { splitName, typeAheadIndex } from '@/lib/names';
import { bookHref, contextQs } from '@/lib/urls';
import { buildLayout, NAV_KEYS, pinnedHeader, revealTop, step, visibleRange, type NavKey } from '@/lib/window';

// The names list, fetched once per search/group/sort and kept while cards
// are opened, so a click sends only the card. Only the rows on screen are in
// the page; the rest is empty space of the right height.

const STORE = 'localcontacts.names:';

export default function NamesList({ version, footerStart }: { version: string; footerStart: ReactNode }) {
  const sp = useSearchParams();
  const router = useRouter();
  // While a card is being edited, created or imports are open, the keys
  // belong to the form, not the list.
  const busyCard = sp.get('edit') === '1' || sp.get('new') === '1' || sp.get('import') === '1';
  const qs = contextQs(new URLSearchParams(sp.toString()));
  const selected = sp.get('new') === '1' ? null : Number(sp.get('id')) || null;

  const [data, setData] = useState<NamesPayload | null>(null);
  const [dataQs, setDataQs] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const lastScroll = useRef(0);
  const frame = useRef(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setBusy(true);
    setError(false);
    fetch(`/api/contacts${qs ? `?${qs}` : ''}`, { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<NamesPayload>;
      })
      .then((payload) => {
        setData(payload);
        setDataQs(qs);
        setBusy(false);
      })
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return;
        setBusy(false);
        setError(true);
      });
    return () => ctrl.abort();
  }, [qs, version, attempt]);

  const layout = useMemo(() => buildLayout(data?.rows.length ?? 0, data?.sections ?? null), [data]);
  const indexOf = useMemo(() => new Map((data?.rows ?? []).map(([id], i) => [id, i])), [data]);

  const scrollTo = useCallback((y: number) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = y;
    lastScroll.current = el.scrollTop;
    setScrollTop(el.scrollTop);
  }, []);

  // A new search, group or sort starts at the top, or where this list was
  // last left in this tab.
  const shownQs = useRef<string | null>(null);
  useEffect(() => {
    if (!data || dataQs === shownQs.current) return;
    const first = shownQs.current === null;
    shownQs.current = dataQs;
    let y = 0;
    if (first) {
      try {
        y = Number(sessionStorage.getItem(STORE + dataQs)) || 0;
      } catch {
        // storage unavailable
      }
    }
    scrollTo(y);
  }, [data, dataQs, scrollTo]);

  // Bring the open card's row into view (deep links, new cards, saves).
  useEffect(() => {
    if (!data || selected === null) return;
    const i = indexOf.get(selected);
    const el = listRef.current;
    if (i === undefined || !el) return;
    const y = revealTop(layout, i, el.scrollTop, el.clientHeight);
    if (y !== null) scrollTo(y);
  }, [data, selected, indexOf, layout, scrollTo, viewH]);

  // Track the viewport height. On a phone the list is hidden while a card is
  // open, which resets its scroll position, so put it back when it returns.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.clientHeight;
      setViewH((prev) => {
        if (prev === 0 && h > 0 && lastScroll.current > 0) {
          el.scrollTop = lastScroll.current;
          setScrollTop(el.scrollTop);
        }
        return h;
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Up and down move between cards, as in Address Book; Home, End and the
  // page keys jump. Active when focus is in the list or on nothing at all.
  const nav = useRef({ data, indexOf, selected, qs, viewH });
  nav.current = { data, indexOf, selected, qs, viewH };
  const typed = useRef({ text: '', at: 0 });
  useEffect(() => {
    if (busyCard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      const inList = !!t && !!listRef.current?.contains(t);
      const idle = !t || t === document.body || t === document.documentElement;

      // Typing letters with the list focused jumps to the first matching name.
      if ((inList || idle) && e.key.length === 1 && (e.key !== ' ' || typed.current.text)) {
        const { data: d, qs: q } = nav.current;
        if (!d || d.rows.length === 0) return;
        const now = Date.now();
        typed.current = { text: (now - typed.current.at < 800 ? typed.current.text : '') + e.key, at: now };
        const sort = new URLSearchParams(q).get('sort');
        const mode = !sort || sort === 'last' ? 'last' : sort === 'first' ? 'first' : 'other';
        const i = typeAheadIndex(d.rows.map((r) => r[1]), typed.current.text, mode, (k) => d.rows[k].length === 3);
        e.preventDefault();
        if (i !== null) router.replace(bookHref(q, { id: d.rows[i][0] }), { scroll: false });
        return;
      }

      if (!NAV_KEYS.has(e.key) || e.shiftKey) return;
      if (!inList && !idle) return;
      const { data: d, indexOf: idx, selected: sel, qs: q, viewH: h } = nav.current;
      if (!d || d.rows.length === 0) return;
      const cur = sel === null ? null : idx.get(sel) ?? null;
      const next = step(d.rows.length, cur, e.key as NavKey, Math.max(1, Math.floor((h || 500) / 25) - 1));
      if (next === null || next === cur) return;
      e.preventDefault();
      router.replace(bookHref(q, { id: d.rows[next][0] }), { scroll: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busyCard, router]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el || frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (el.clientHeight === 0) return;
      lastScroll.current = el.scrollTop;
      setScrollTop(el.scrollTop);
      try {
        sessionStorage.setItem(STORE + qs, String(el.scrollTop));
      } catch {
        // storage unavailable
      }
    });
  };

  const [first, last] = visibleRange(layout, scrollTop, viewH || 800);
  const pin = pinnedHeader(layout, scrollTop);
  const items: ReactNode[] = [];
  if (data) {
    for (let e = first; e <= last; e++) {
      const entry = layout.entries[e];
      const top = layout.tops[e];
      if (entry.kind === 'header') {
        items.push(
          <div key={`h-${entry.letter}`} className={`name-section${e === 0 ? ' is-first' : ''}`} style={{ top }}>
            {entry.letter}
          </div>
        );
      } else {
        const row = data.rows[entry.index];
        const [id, full] = row;
        const n = splitName(full, row.length === 3);
        const isSel = id === selected;
        items.push(
          <Link
            key={id}
            href={bookHref(qs, { id })}
            scroll={false}
            prefetch={false}
            className={`name-row${isSel ? ' is-selected' : ''}`}
            aria-current={isSel ? 'true' : undefined}
            tabIndex={-1}
            style={{ top }}
            // Keep focus on the list, not the row: the row may scroll out of the
            // drawn window and take the focus (and type-to-jump) with it.
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              listRef.current?.focus({ preventScroll: true });
            }}
          >
            {n.first}
            {n.last && (
              <>
                {' '}
                <b>{n.last}</b>
              </>
            )}
            {n.suffix && ` ${n.suffix}`}
          </Link>
        );
      }
    }
  }

  const count = data?.count ?? 0;
  return (
    <>
      <div
        className="names-list"
        ref={listRef}
        onScroll={onScroll}
        aria-busy={busy || undefined}
        tabIndex={0}
        aria-label="Names. Use the arrow keys to move between cards, or type a name to jump to it."
      >
        {pin && (
          <div className="names-pin" aria-hidden="true">
            <div className="name-section" style={{ transform: `translateY(${pin.offset}px)` }}>
              {pin.letter}
            </div>
          </div>
        )}
        {!data && !error && <p className="names-empty">Loading…</p>}
        {error && (
          <p className="names-empty">
            Couldn’t load names.{' '}
            <button type="button" className="btn names-retry" onClick={() => setAttempt((a) => a + 1)}>
              Retry
            </button>
          </p>
        )}
        {data && count === 0 && (
          <p className="names-empty">
            No cards.{' '}
            {!qs && (
              <Link href={bookHref(qs, { import: true })} scroll={false} prefetch={false} className="names-import">
                Import contacts…
              </Link>
            )}
          </p>
        )}
        <noscript>
          <p className="names-empty">The names list needs JavaScript.</p>
        </noscript>
        {data && (
          <div className="names-canvas" style={{ height: layout.total }}>
            {items}
          </div>
        )}
      </div>
      <div className="names-footer">
        {footerStart}
        <span className="names-count">
          {data ? `${count.toLocaleString()} ${count === 1 ? 'card' : 'cards'}${data.truncated ? ' (first 500)' : ''}` : ''}
        </span>
      </div>
    </>
  );
}
