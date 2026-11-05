/**
 * Tidy contacts whose display name is an email address or junk (a side effect of
 * Google/iCloud exports). Strategy, in order of preference:
 *   1. Strip a "Real Name (email@x.com)" or "Real Name" <email@x.com> wrapper -> "Real Name".
 *   2. Strip a "Name @ Company" suffix -> "Name", when the card has no company yet
 *      (it gets that one) or the same company.
 *   3. Derive "First Last" from a first.last@ / first_last@ address.
 *   4. Otherwise fall back to the bare email address (cleaner than the wrapper).
 *
 * A name is only changed when we can produce something strictly better, and nothing
 * is lost: an address that appears only in the name is added to the card's emails.
 * A backup of the database is saved to data/backups/ before writing.
 *
 * Usage:
 *   npm run clean:names            # dry run: prints proposed changes only
 *   npm run clean:names -- --apply # write the changes
 */
import { applyNameFixes, nameCandidateCount, nameFixCandidates } from '../src/lib/cleanup/names';

const USAGE = 'Usage: npm run clean:names [-- --apply]';
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
  const looked = nameCandidateCount();
  const changes = nameFixCandidates();
  const derived = changes.filter((c) => c.derived).length;
  console.log(`Candidates (email/junk names): ${looked}`);
  console.log(`Proposed changes             : ${changes.length}`);
  console.log(`  → real name derived        : ${derived}`);
  console.log(`  → cleaned to bare email    : ${changes.length - derived}`);
  console.log(`Unchanged (already clean-ish): ${looked - changes.length}`);
  console.log('');
  for (const c of changes) {
    const tag = c.derived ? 'NAME ' : 'email';
    const extra = [c.addEmails.length ? `keeps ${c.addEmails.join(', ')} as an email` : '', c.company ? `company: ${c.company}` : ''].filter(Boolean);
    console.log(`  [${tag}] "${c.from}"  ->  "${c.to}"${extra.length ? `  (${extra.join('; ')})` : ''}`);
  }

  if (!APPLY) {
    console.log('\n(dry run — re-run with --apply to write these changes)');
    return;
  }
  if (changes.length === 0) return;
  const { changed, backup } = applyNameFixes(changes.map((c) => c.id));
  console.log(`\nApplied ${changed} updates.`);
  if (backup) console.log(`Backup saved first: ${backup}`);
}

main();
