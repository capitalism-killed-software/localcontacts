import type { ContactFilter, SortDir, SortKey } from './contacts';

// One parser for the book's URL parameters, shared by the page, the names
// API and the export script so they always agree on what a URL means.

export type ViewSort = 'last' | 'first' | 'company' | 'connected' | 'last_contacted';

export const VIEW_SORTS: Array<{ value: ViewSort; label: string }> = [
  { value: 'last', label: 'Last name' },
  { value: 'first', label: 'First name' },
  { value: 'company', label: 'Company' },
  { value: 'connected', label: 'Date connected' },
  { value: 'last_contacted', label: 'Last contacted' },
];

export const FILTER_KEYS = new Set<ContactFilter>([
  'all', 'email', 'phone', 'email_phone', 'no_email', 'no_phone', 'has_notes', 'name_is_email',
]);

const VIEW_SORT_KEYS = new Set<string>(VIEW_SORTS.map((s) => s.value));

export type BookParams = {
  q: string;
  filter: ContactFilter;
  source: string;
  industry: string;
  viewSort: ViewSort;
  dir: 'desc' | null;
  id: number | null;
  isNew: boolean;
  edit: boolean;
};

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

function getter(raw: RawParams): (k: string) => string {
  if (raw instanceof URLSearchParams) return (k) => (raw.get(k) ?? '').trim();
  return (k) => {
    const v = raw[k];
    return (Array.isArray(v) ? v[0] ?? '' : v ?? '').trim();
  };
}

// `knownTags`, when given, limits `source` to tags that exist; anything else
// falls back to 'all'. Without it any well-formed tag is accepted.
export function parseBook(raw: RawParams, opts: { knownTags?: Set<string> } = {}): BookParams {
  const get = getter(raw);
  const rawFilter = get('filter') as ContactFilter;
  const rawSource = get('source') || 'all';
  const sourceOk =
    rawSource === 'all' ||
    rawSource === 'untagged' ||
    (opts.knownTags ? opts.knownTags.has(rawSource) : /^[A-Za-z0-9_.-]+$/.test(rawSource));
  const rawSort = get('sort');
  const idNum = Number(get('id'));
  const isNew = get('new') === '1';
  const id = Number.isFinite(idNum) && idNum > 0 ? idNum : null;
  return {
    q: get('q'),
    filter: FILTER_KEYS.has(rawFilter) ? rawFilter : 'all',
    source: sourceOk ? rawSource : 'all',
    industry: get('industry') || 'all',
    viewSort: VIEW_SORT_KEYS.has(rawSort) ? (rawSort as ViewSort) : 'last',
    dir: get('dir') === 'desc' ? 'desc' : null,
    id,
    isNew,
    edit: !isNew && id !== null && get('edit') === '1',
  };
}

// The data-layer sort for a view sort. "last" is re-sorted by surname later.
export function listArgs(p: Pick<BookParams, 'viewSort' | 'dir'>): { sort: SortKey; dir: SortDir } {
  switch (p.viewSort) {
    case 'company':
      return { sort: 'company', dir: p.dir ?? 'asc' };
    case 'connected':
      return { sort: 'connected', dir: 'desc' };
    case 'last_contacted':
      return { sort: 'last_contacted', dir: 'desc' };
    default:
      return { sort: 'name', dir: 'asc' };
  }
}
