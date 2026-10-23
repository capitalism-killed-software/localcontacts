import type { Contact } from './contacts';
import type { ViewSort } from './context';
import { sectionize } from './names';

// What the names list needs, and nothing more: ids and names in display
// order, plus where each letter starts. The client splits names itself, only
// for the rows on screen.
export type NamesPayload = {
  count: number;
  truncated: boolean;
  rows: Array<[number, string]>;
  sections: Array<{ letter: string; start: number }> | null;
};

export function buildNamesPayload(rows: Contact[], viewSort: ViewSort, truncated = false): NamesPayload {
  if (viewSort === 'last' || viewSort === 'first') {
    const out: Array<[number, string]> = [];
    const sections: Array<{ letter: string; start: number }> = [];
    for (const s of sectionize(rows, viewSort)) {
      sections.push({ letter: s.letter, start: out.length });
      for (const it of s.items) out.push([it.contact.id, it.contact.full_name]);
    }
    return { count: out.length, truncated, rows: out, sections };
  }
  return { count: rows.length, truncated, rows: rows.map((c) => [c.id, c.full_name]), sections: null };
}
