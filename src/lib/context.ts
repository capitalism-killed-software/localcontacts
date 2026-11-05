import { parseId } from './ids';
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

// The sheets that can take the card's place on the right page. The import sheet
// keeps its old address (?import=1); the others are ?sheet=<name>.
export const SHEETS = ['import', 'guide', 'tidy', 'backups', 'export', 'about'] as const;
export type Sheet = (typeof SHEETS)[number];
const SHEET_KEYS = new Set<string>(SHEETS);

export type BookParams = {
  q: string;
  filter: ContactFilter;
  source: string;
  industry: string;
  viewSort: ViewSort;
  dir: 'desc' | null;
  id: number | null;
  isNew: boolean;
  sheet: Sheet | null;
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
  // The id is read as written: " 1" or "+1" is not a card id.
  const rawId = raw instanceof URLSearchParams ? raw.get('id') : Array.isArray(raw.id) ? raw.id[0] : raw.id;
  const rawFilter = get('filter') as ContactFilter;
  // Tags are compared without case, as the list and the export filter them.
  const rawSource = (get('source') || 'all').toLowerCase();
  const known = opts.knownTags ? new Set([...opts.knownTags].map((t) => t.toLowerCase())) : null;
  const sourceOk =
    rawSource === 'all' ||
    rawSource === 'untagged' ||
    (known ? known.has(rawSource) : /^[A-Za-z0-9_.-]+$/.test(rawSource));
  const rawSort = get('sort');
  const id = parseId(rawId ?? null);
  const isNew = get('new') === '1';
  const rawSheet = get('sheet');
  const sheet: Sheet | null = isNew ? null : get('import') === '1' ? 'import' : SHEET_KEYS.has(rawSheet) ? (rawSheet as Sheet) : null;
  return {
    q: get('q'),
    filter: FILTER_KEYS.has(rawFilter) ? rawFilter : 'all',
    source: sourceOk ? rawSource : 'all',
    industry: get('industry') || 'all',
    viewSort: VIEW_SORT_KEYS.has(rawSort) ? (rawSort as ViewSort) : 'last',
    dir: get('dir') === 'desc' ? 'desc' : null,
    id,
    isNew,
    sheet,
    edit: !isNew && !sheet && id !== null && get('edit') === '1',
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
