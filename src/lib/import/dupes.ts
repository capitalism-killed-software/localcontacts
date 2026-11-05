import type { CountryCode } from 'libphonenumber-js';
import { mergeRecInto, rowToRec, type ExistingRow, type Rec } from './merge';
import { nameKey, NO_NAME } from './normalize';
import type { PhotoType } from '../photo';

// Explicit duplicate merges (`npm run merge:dupes -- keep:drop ...`): the
// dropped card is merged into the kept one exactly as an import would merge it
// (every email, phone, link and source is kept, an empty photo frame is filled),
// and single values that disagree are written into the kept card's note.

export type StoredRow = ExistingRow & { photo: Uint8Array | null; photo_type: string | null };

export type Pair = [keep: number, drop: number];

/** Why a list of pairs can't be applied as given, or null when it can. */
export function pairProblem(pairs: Pair[]): string | null {
  const droppedInto = new Map<number, number>();
  for (const [keep, drop] of pairs) {
    if (keep === drop) return `Refusing to merge #${keep} into itself.`;
    const earlier = droppedInto.get(drop);
    if (earlier === keep) return `The pair ${keep}:${drop} is listed twice.`;
    if (earlier !== undefined) return `#${drop} is merged away twice (into #${earlier} and into #${keep}).`;
    droppedInto.set(drop, keep);
  }
  for (const [keep, drop] of pairs) {
    const final = droppedInto.get(keep);
    if (final !== undefined) {
      return `#${keep} keeps #${drop} but is itself merged into #${final}. Merge both into the card you keep: ${final}:${keep} ${final}:${drop}.`;
    }
  }
  return null;
}

const LABELS = { title: 'title', company: 'company', industry: 'industry', connected_on: 'connected', last_contacted: 'last contacted' } as const;

const differs = (a: string | null, b: string | null) => !!a && !!b && a.trim().toLowerCase() !== b.trim().toLowerCase();

/** Merges `drop` into `keep` (a Rec built from the kept row, possibly already merged with others). */
export function mergeStored(keep: Rec, drop: StoredRow, country: CountryCode): { conflicts: string[] } {
  const other = rowToRec(drop);
  if (drop.photo && drop.photo_type) other.photo = { data: Buffer.from(drop.photo), type: drop.photo_type as PhotoType };
  const conflicts: string[] = [];
  for (const f of Object.keys(LABELS) as (keyof typeof LABELS)[]) {
    if (differs(keep[f], other[f])) conflicts.push(`${LABELS[f]}: ${other[f]}`);
  }
  mergeRecInto(keep, other, country);
  if (drop.full_name !== NO_NAME && !drop.full_name.includes('@') && nameKey(drop.full_name) !== nameKey(keep.full_name)) {
    conflicts.unshift(`name: ${drop.full_name}`);
  }
  if (conflicts.length) {
    const line = `Merged duplicate — also ${conflicts.join('; ')}`;
    if (!keep.notes?.includes(line)) keep.notes = keep.notes ? `${keep.notes}\n${line}` : line;
  }
  return { conflicts };
}
