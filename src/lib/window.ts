// Layout maths for the windowed names list: which headers and rows exist,
// where each one sits, and which of them are on screen. Pure, so it is
// tested without a browser.

export type Dims = { header: number; row: number };
export const DIMS: Dims = { header: 20, row: 25 };

export type Entry = { kind: 'header'; letter: string } | { kind: 'row'; index: number };

export type Layout = {
  entries: Entry[];
  tops: number[]; // top offset of each entry
  total: number; // full height of the list
  rowEntry: number[]; // row index -> entry index
  headerEntries: number[]; // entry indices of headers, in order
  dims: Dims;
};

// `sections` are { letter, start } with `start` the first row index of that
// letter; null means a flat list with no headers.
export function buildLayout(
  rowCount: number,
  sections: Array<{ letter: string; start: number }> | null,
  dims: Dims = DIMS
): Layout {
  const entries: Entry[] = [];
  const tops: number[] = [];
  const rowEntry: number[] = new Array(rowCount);
  const headerEntries: number[] = [];
  let y = 0;
  let s = 0;
  for (let i = 0; i < rowCount; i++) {
    while (sections && s < sections.length && sections[s].start === i) {
      headerEntries.push(entries.length);
      entries.push({ kind: 'header', letter: sections[s].letter });
      tops.push(y);
      y += dims.header;
      s++;
    }
    rowEntry[i] = entries.length;
    entries.push({ kind: 'row', index: i });
    tops.push(y);
    y += dims.row;
  }
  return { entries, tops, total: y, rowEntry, headerEntries, dims };
}

const heightOf = (L: Layout, e: number): number => (L.entries[e].kind === 'header' ? L.dims.header : L.dims.row);

// Index of the last entry whose top is <= y (0 if none).
function entryAt(L: Layout, y: number): number {
  let lo = 0;
  let hi = L.tops.length - 1;
  if (hi < 0) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (L.tops[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// Inclusive range of entry indices to render, with some overscan.
export function visibleRange(L: Layout, scrollTop: number, viewH: number, overscan = 8): [number, number] {
  if (L.entries.length === 0) return [0, -1];
  const first = Math.max(0, entryAt(L, Math.max(0, scrollTop)) - overscan);
  const last = Math.min(L.entries.length - 1, entryAt(L, scrollTop + Math.max(0, viewH)) + overscan);
  return [first, last];
}

// The section header pinned to the top of the viewport, and how far the next
// header has pushed it up (0 or negative).
export function pinnedHeader(L: Layout, scrollTop: number): { letter: string; offset: number } | null {
  if (L.headerEntries.length === 0 || scrollTop <= 0) return null;
  let k = -1;
  for (let lo = 0, hi = L.headerEntries.length - 1; lo <= hi; ) {
    const mid = (lo + hi) >> 1;
    if (L.tops[L.headerEntries[mid]] <= scrollTop) {
      k = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (k < 0) return null;
  const e = L.headerEntries[k];
  const next = L.headerEntries[k + 1];
  const offset = next === undefined ? 0 : Math.min(0, L.tops[next] - scrollTop - L.dims.header);
  return { letter: (L.entries[e] as { letter: string }).letter, offset };
}

// The scrollTop that brings row `index` fully into view, moving as little as
// possible, or null when it is already visible. The pinned header covers the
// top `header` pixels when the list has sections.
export function revealTop(L: Layout, index: number, scrollTop: number, viewH: number): number | null {
  const e = L.rowEntry[index];
  if (e === undefined || viewH <= 0) return null;
  const top = L.tops[e];
  const bottom = top + heightOf(L, e);
  const cover = L.headerEntries.length ? L.dims.header : 0;
  if (top < scrollTop + cover) return Math.max(0, top - cover);
  if (bottom > scrollTop + viewH) return Math.max(0, bottom - viewH);
  return null;
}

export type NavKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End' | 'PageDown' | 'PageUp';
export const NAV_KEYS = new Set<string>(['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp']);

// The row a navigation key moves to from `current` (null when nothing is
// selected), clamped to the list; null when the list is empty.
export function step(count: number, current: number | null, key: NavKey, page = 10): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  if (current === null || current < 0 || current > last) {
    return key === 'ArrowUp' || key === 'End' || key === 'PageUp' ? last : 0;
  }
  switch (key) {
    case 'ArrowDown':
      return Math.min(last, current + 1);
    case 'ArrowUp':
      return Math.max(0, current - 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
    case 'PageDown':
      return Math.min(last, current + page);
    case 'PageUp':
      return Math.max(0, current - page);
  }
}
