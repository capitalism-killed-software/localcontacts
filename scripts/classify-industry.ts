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
 * The rules live in src/lib/industry.ts (Clean-up in the book uses them too).
 */
import { getDb } from '../src/lib/db';
import { applyIndustries, industryProposals } from '../src/lib/industry';

const USAGE = 'Usage: npm run classify:industry [-- --apply]';
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}
const unknown = args.filter((a) => a !== '--apply');
if (unknown.length) {
  console.error(`Unknown option ${unknown[0]}.\n${USAGE}`);
  process.exit(1);
}
const APPLY = args.includes('--apply');

function main() {
  const considered = (getDb().prepare('SELECT COUNT(*) AS c FROM contacts WHERE industry IS NULL').get() as { c: number }).c;
  const updates = industryProposals();
  const tally = new Map<string, number>();
  for (const u of updates) tally.set(u.industry, (tally.get(u.industry) ?? 0) + 1);

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
  if (updates.length === 0) return;
  const { changed, backup } = applyIndustries(updates.map((u) => u.id));
  console.log(`\nApplied ${changed} industry classifications.`);
  if (backup) console.log(`Backup saved first: ${backup}`);
}

main();
