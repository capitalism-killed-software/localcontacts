// The book is one route. Six "context" params describe what the names list
// shows (search, group, sort); three "selection" params say which card is
// open. Context survives every navigation and is what server actions redirect
// back to; selection is rebuilt per link.

export type ContextInput = {
  q?: string | null;
  filter?: string | null;
  source?: string | null;
  industry?: string | null;
  sort?: string | null;
  dir?: string | null;
};

const read = (input: URLSearchParams | ContextInput, key: keyof ContextInput): string => {
  const v = input instanceof URLSearchParams ? input.get(key) : input[key];
  return (v ?? '').trim();
};

// Only the context params, defaults dropped, in a fixed order. Safe to build
// from untrusted input: anything else is ignored.
export function contextQs(input: URLSearchParams | ContextInput): string {
  const p = new URLSearchParams();
  const q = read(input, 'q');
  if (q) p.set('q', q);
  for (const k of ['filter', 'source', 'industry'] as const) {
    const v = read(input, k);
    if (v && v !== 'all') p.set(k, v);
  }
  const sort = read(input, 'sort');
  if (sort && sort !== 'default' && sort !== 'last') {
    p.set('sort', sort);
    if (read(input, 'dir') === 'desc') p.set('dir', 'desc');
  }
  return p.toString();
}

export type Selection = { id?: number | null; edit?: boolean; new?: boolean };

export function bookHref(qs: string, sel: Selection = {}): string {
  const p = new URLSearchParams(qs);
  if (sel.new) {
    p.set('new', '1');
  } else if (sel.id != null && Number.isFinite(sel.id) && sel.id > 0) {
    p.set('id', String(sel.id));
    if (sel.edit) p.set('edit', '1');
  }
  const s = p.toString();
  return s ? `/?${s}` : '/';
}
