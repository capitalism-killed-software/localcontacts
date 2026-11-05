import type { Contact } from './contacts';
import type { ViewSort } from './context';
import { isCompanyCard, sectionize } from './names';

// What the names list needs, and nothing more: ids and names in display
// order, plus where each letter starts. The client splits names itself, only
// for the rows on screen.
export type NamesPayload = {
  count: number;
  truncated: boolean;
  // [id, name], or [id, name, 1] for a company's own card (no surname).
  rows: NameRowTuple[];
  sections: Array<{ letter: string; start: number }> | null;
};

export type NameRowTuple = [number, string] | [number, string, 1];

const tuple = (c: Contact): NameRowTuple => (isCompanyCard(c.full_name, c.company) ? [c.id, c.full_name, 1] : [c.id, c.full_name]);

export function buildNamesPayload(rows: Contact[], viewSort: ViewSort, truncated = false): NamesPayload {
  if (viewSort === 'last' || viewSort === 'first') {
    const out: NameRowTuple[] = [];
    const sections: Array<{ letter: string; start: number }> = [];
    for (const s of sectionize(rows, viewSort)) {
      sections.push({ letter: s.letter, start: out.length });
      for (const it of s.items) out.push(tuple(it.contact));
    }
    return { count: out.length, truncated, rows: out, sections };
  }
  return { count: rows.length, truncated, rows: rows.map(tuple), sections: null };
}
