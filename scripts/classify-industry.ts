/**
 * Heuristic industry classifier. Assigns an `industry` to contacts by matching
 * deterministic keyword rules against their company + title. No AI, no guessing
 * beyond the rule table — anything that doesn't match a rule is left NULL for
 * manual entry, and existing (non-NULL) industries are never overwritten.
 *
 * Usage:
 *   npm run classify:industry            # dry run — prints what it would set
 *   npm run classify:industry -- --apply # write the classifications
 *
 * Rules are ordered; the first match wins, so put specific buckets (Crypto,
 * Venture Capital) before broad ones (Finance, Software).
 */
import { getDb } from '../src/lib/db';

const APPLY = process.argv.includes('--apply');

const RULES: Array<{ industry: string; test: RegExp }> = [
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

function classify(company: string | null, title: string | null): string | null {
  const hay = [company, title].filter(Boolean).join(' ').toLowerCase();
  if (!hay) return null;
  for (const r of RULES) if (r.test.test(hay)) return r.industry;
  return null;
}

function main() {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, company, title FROM contacts WHERE industry IS NULL')
    .all() as Array<{ id: number; company: string | null; title: string | null }>;

  const updates: Array<{ id: number; industry: string }> = [];
  const tally = new Map<string, number>();
  for (const r of rows) {
    const ind = classify(r.company, r.title);
    if (ind) {
      updates.push({ id: r.id, industry: ind });
      tally.set(ind, (tally.get(ind) ?? 0) + 1);
    }
  }

  const considered = rows.length;
  const classified = updates.length;
  console.log(`Contacts with no industry : ${considered}`);
  console.log(`Would classify            : ${classified}`);
  console.log(`Left unclassified         : ${considered - classified}`);
  console.log('');
  for (const [ind, n] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${ind}`);
  }

  if (!APPLY) {
    console.log('\n(dry run — re-run with --apply to write)');
    return;
  }

  const upd = db.prepare(
    `UPDATE contacts SET industry = ?, updated_at = datetime('now') WHERE id = ? AND industry IS NULL`
  );
  db.exec('BEGIN');
  try {
    for (const u of updates) upd.run(u.industry, u.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log(`\nApplied ${classified} industry classifications.`);
}

main();
