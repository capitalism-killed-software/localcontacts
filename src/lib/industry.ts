import { bulkWrite } from './backups';
import { getDb } from './db';

// Suggested industries: deterministic keyword rules matched against a card's
// company and title. No AI and no guessing beyond the rule table: a card that
// matches no rule is left empty, and an industry already set is never changed.
// Rules are ordered and the first match wins, so specific buckets (Crypto,
// Venture Capital) come before broad ones (Finance, Software).

export const RULES: Array<{ industry: string; test: RegExp }> = [
  { industry: 'Crypto / Blockchain', test: /\b(crypto|blockchain|bitcoin|web3|defi|chainalysis|coinbase|ethereum|stablecoin|\bnft\b)\b/ },
  { industry: 'Venture Capital / PE', test: /\b(ventures?|venture capital|private equity|growth equity|\bvc\b|capital partners|angel investor)\b/ },
  { industry: 'Finance / Banking', test: /\b(bank|financial|finance|fintech|\bcapital\b|invest|asset management|wealth|securities|trading|trader|hedge fund|\bfund\b|brokerage|insurance|accounting|\bcpa\b)\b/ },
  { industry: 'Software / Technology', test: /\b(software|technolog|\bai\b|machine learning|\bml\b|data|cloud|saas|developer|engineer|computing|platform|\bapp\b|digital|\bit\b|cyber|information technology|devops|robotics)\b/ },
  { industry: 'Healthcare / Biotech', test: /\b(health|healthcare|medical|medicine|clinic|hospital|pharma|biotech|\bbio\b|therapeutic|therapy|dental|physician|nurse|patient|wellness)\b/ },
  { industry: 'Education', test: /\b(universit|college|school|academ|educat|\bedu\b|teacher|professor|student|tutor|e-?learning)\b/ },
  { industry: 'Real Estate / Construction', test: /\b(real estate|realty|realtor|propert|construct|builder|building|concrete|contracting|architect|\bhomes?\b|mortgage|brokerage of record)\b/ },
  { industry: 'Legal', test: /\b(\blaw\b|legal|attorney|\bllp\b|lawyer|counsel|paralegal|litigation|barrister|solicitor)\b/ },
  { industry: 'Marketing / Media', test: /\b(marketing|\bmedia\b|advertis|\bpr\b|public relations|creative|\bbrand\b|content|communications|journalis|publish|broadcast)\b/ },
  { industry: 'Consulting', test: /\b(consult|advisory|advisor)\b/ },
  { industry: 'Recruiting / HR', test: /\b(recruit|talent|staffing|\bhr\b|human resources|headhunt)\b/ },
  { industry: 'Retail / Consumer', test: /\b(retail|e-?commerce|commerce|\bshop\b|apparel|fashion|coffee|beverage|consumer|\bcpg\b|grocery|\bbrands?\b)\b/ },
  { industry: 'Hospitality / Travel', test: /\b(hotel|hospitality|travel|tourism|resort|airline|restaurant|catering)\b/ },
  { industry: 'Energy / Cleantech', test: /\b(energy|solar|\boil\b|\bgas\b|\bpower\b|atom|nuclear|renewable|cleantech|battery|utilit)\b/ },
  { industry: 'Manufacturing / Industrial', test: /\b(manufactur|\bmfg\b|industrial|factory|machining|fabricat|materials|logistics|\bsupply chain\b)\b/ },
  { industry: 'Nonprofit / Government', test: /\b(non-?profit|foundation|\bngo\b|charit|government|\bgov\b|ministry|municipal|public sector|\bcity of\b)\b/ },
];

export function classify(company: string | null, title: string | null): string | null {
  const hay = [company, title].filter(Boolean).join(' ').toLowerCase();
  if (!hay) return null;
  for (const r of RULES) if (r.test.test(hay)) return r.industry;
  return null;
}

export type IndustryProposal = { id: number; name: string; company: string | null; title: string | null; industry: string };

type Row = { id: number; full_name: string; company: string | null; title: string | null };

const proposalsFor = (rows: Row[]): IndustryProposal[] =>
  rows.flatMap((r) => {
    const industry = classify(r.company, r.title);
    return industry ? [{ id: r.id, name: r.full_name, company: r.company, title: r.title, industry }] : [];
  });

/** An industry for every card without one that a rule matches, by name. */
export function industryProposals(): IndustryProposal[] {
  const rows = getDb()
    .prepare('SELECT id, full_name, company, title FROM contacts WHERE industry IS NULL ORDER BY full_name, id')
    .all() as Row[];
  return proposalsFor(rows);
}

/**
 * Sets the suggested industry on the given cards, after a backup. The
 * suggestions are worked out again here, so a card that got an industry in the
 * meantime, or no longer matches a rule, is left alone.
 */
export function applyIndustries(ids: number[]): { changed: number; backup: string | null } {
  const wanted = new Set(ids);
  const todo = industryProposals().filter((p) => wanted.has(p.id));
  if (todo.length === 0) return { changed: 0, backup: null };
  const { result, backup } = bulkWrite('industries', null, (db) => {
    const upd = db.prepare(`UPDATE contacts SET industry = ?, updated_at = datetime('now') WHERE id = ? AND industry IS NULL`);
    return todo.reduce((n, p) => n + Number(upd.run(p.industry, p.id).changes), 0);
  });
  return { changed: result, backup };
}
