// The contact fields a generic CSV's columns can be mapped to. Kept apart from
// the parser so the import page can use the list without loading it.

export const MAPPABLE = [
  'full_name', 'first_name', 'last_name', 'email', 'phone',
  'company', 'title', 'notes', 'url', 'connected_on', 'uid',
] as const;
export type MappableField = (typeof MAPPABLE)[number];
export type FieldMap = Partial<Record<MappableField, string>>;

export const FIELD_LABELS: Record<MappableField, string> = {
  full_name: 'name',
  first_name: 'first name',
  last_name: 'last name',
  email: 'email',
  phone: 'phone',
  company: 'company',
  title: 'title',
  notes: 'note',
  url: 'link',
  connected_on: 'connected',
  uid: 'card id',
};

// A map from untrusted input (the import page's JSON): known fields with
// non-empty column names only.
export function cleanFieldMap(raw: unknown): FieldMap {
  const out: FieldMap = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const f of MAPPABLE) {
    const v = (raw as Record<string, unknown>)[f];
    if (typeof v === 'string' && v.trim()) out[f] = v.trim();
  }
  return out;
}
