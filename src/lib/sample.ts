import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bulkWrite } from './backups';
import { getDb } from './db';
import { runImport, type ImportReport } from './import/run';

// Made-up people for trying the app (the first-run welcome's "Look around with
// sample people"). They are tagged "sample", the importer never merges real
// contacts into them, and one click removes them again.

export const SAMPLE_TAG = 'sample';
export const SAMPLE_FILE = join(process.cwd(), 'seed', 'sample-people.vcf');

/** Cards that are only sample people (a card that also came from a real file is not counted). */
export function sampleCount(): number {
  return (getDb().prepare('SELECT COUNT(*) AS c FROM contacts WHERE sources = ?').get(SAMPLE_TAG) as { c: number }).c;
}

export function loadSamplePeople(): ImportReport {
  const empty = (getDb().prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c === 0;
  const file = { name: 'sample-people.vcf', bytes: readFileSync(SAMPLE_FILE), source: SAMPLE_TAG };
  // Nothing to lose in an empty book, so no backup then.
  return runImport([file], { apply: true, backup: !empty });
}

/** Removes the sample people (after a backup). Returns how many cards went. */
export function removeSamplePeople(): number {
  if (sampleCount() === 0) return 0;
  return bulkWrite('sample', 'remove sample people', (db) =>
    Number(db.prepare('DELETE FROM contacts WHERE sources = ?').run(SAMPLE_TAG).changes)
  ).result;
}
