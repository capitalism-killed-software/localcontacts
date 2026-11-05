import { getContact, type Contact } from '../contacts';
import { tagLabel } from '../groups';
import { industryProposals, type IndustryProposal } from '../industry';
import { NO_NAME } from '../constants';
import { bookDuplicates, type DuplicateReason } from './dupes';
import { nameFixCandidates, type NameCandidate } from './names';

// What the Clean-up sheet shows: one tab at a time, a page at a time, worked
// out afresh on every visit (Apply works it out again before writing).

export const TIDY_TABS = ['dupes', 'names', 'industries'] as const;
export type TidyTab = (typeof TIDY_TABS)[number];

const PAIRS_PER_PAGE = 20;
const ROWS_PER_PAGE = 100;

export type CardSide = {
  id: number;
  name: string;
  emails: string[];
  phones: string[];
  company: string | null;
  title: string | null;
  groups: string | null;
  industry: string | null;
  note: string | null;
  photo: boolean;
};

export type PairView = { a: CardSide; b: CardSide; reason: DuplicateReason; why: string };

export type TidyData = {
  tab: TidyTab;
  counts: Record<TidyTab, number>;
  page: number;
  pages: number;
  pairs: PairView[];
  largeGroups: number[];
  names: NameCandidate[];
  industries: IndustryProposal[];
};

const lines = (v: string | null) => (v ? v.split('\n').map((s) => s.trim()).filter(Boolean) : []);

function side(c: Contact): CardSide {
  const note = c.notes?.trim() ?? null;
  return {
    id: c.id,
    name: c.full_name === NO_NAME ? '' : c.full_name,
    emails: [c.email, ...lines(c.alt_emails)].filter((x): x is string => !!x),
    phones: [c.phone, ...lines(c.alt_phones)].filter((x): x is string => !!x),
    company: c.company,
    title: c.title,
    groups: c.sources ? c.sources.split(',').map(tagLabel).join(', ') : null,
    industry: c.industry,
    note: note && note.length > 120 ? `${note.slice(0, 117)}…` : note,
    photo: !!c.photo_type,
  };
}

function why(reason: DuplicateReason, a: CardSide, b: CardSide): string {
  if (reason === 'email') return 'Same email address';
  if (reason === 'phone') return 'Same phone number';
  const differ = (x: string[], y: string[]) => x.length > 0 && y.length > 0 && !x.some((v) => y.map((w) => w.toLowerCase()).includes(v.toLowerCase()));
  return differ(a.emails, b.emails) && differ(a.phones, b.phones)
    ? 'Same name, but different emails and phones: they may be two people'
    : 'Same name';
}

const isTab = (v: string | null | undefined): v is TidyTab => (TIDY_TABS as readonly string[]).includes(v ?? '');

export function tidyData(rawTab: string | null | undefined, rawPage: string | null | undefined): TidyData {
  const dupes = bookDuplicates();
  const names = nameFixCandidates();
  const industries = industryProposals();
  const counts = { dupes: dupes.pairs.length, names: names.length, industries: industries.length };
  // Duplicates unless another tab is chosen (not "the first with something in
  // it": the sheet would jump to another tab after an Apply emptied this one).
  const tab: TidyTab = isTab(rawTab) ? rawTab : 'dupes';
  const per = tab === 'dupes' ? PAIRS_PER_PAGE : ROWS_PER_PAGE;
  const pages = Math.max(1, Math.ceil(counts[tab] / per));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(rawPage)) || 1));
  const slice = <T,>(xs: T[]) => xs.slice((page - 1) * per, page * per);

  const pairs: PairView[] = [];
  if (tab === 'dupes') {
    for (const p of slice(dupes.pairs)) {
      const a = getContact(p.a);
      const b = getContact(p.b);
      if (!a || !b) continue;
      const sa = side(a);
      const sb = side(b);
      pairs.push({ a: sa, b: sb, reason: p.reason, why: why(p.reason, sa, sb) });
    }
  }
  return {
    tab,
    counts,
    page,
    pages,
    pairs,
    largeGroups: dupes.largeGroups,
    names: tab === 'names' ? slice(names) : [],
    industries: tab === 'industries' ? slice(industries) : [],
  };
}
