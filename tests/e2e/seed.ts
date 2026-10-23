// Fresh database for the browser tests: every fixture plus 7,000 generated
// people, so the names list is tested at a realistic size. Deterministic.
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.E2E_DIR;
const db = process.env.CONTACTS_DB_PATH;
if (!dir || !db) throw new Error('E2E_DIR and CONTACTS_DB_PATH must be set (playwright.config.ts does this)');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const FIRST = ['Ada', 'Grace', 'Alan', 'Mary', 'Renée', 'José', 'Wei', 'Priya', 'Marcus', 'Nadia', 'Hedy', 'Linus', 'Marie', 'Kat', 'Tom', 'Sara', 'Omar', 'Yuki', 'Ivan', 'Lena'];
const LAST = ['Lovell', 'Hopkins', 'Turner', 'Shelton', 'Brook', 'Núñez', 'Chen', 'Raman', 'Thompson', 'Okafor', 'Lamb', 'Pauling', 'Curie', 'Johnson', 'Baker', 'Lee', 'Khan', 'Sato', 'Petrov', 'Meyer', 'Zimmer', 'Quinn', 'Young', 'Davis', 'Evans', 'Fischer', 'Garcia', 'Ito', 'Varga', 'Xu', 'Wolfe'];
let seed = 7;
const rand = (n: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed % n;
};
const rows = ['Name,Email,Phone,Company'];
for (let i = 0; i < 7000; i++) {
  rows.push(`${FIRST[rand(FIRST.length)]} ${LAST[rand(LAST.length)]}${i},person${i}@example.com,+1 202 555 ${String(i).padStart(4, '0')},Company ${i % 300}`);
}

async function main() {
  const { runImport } = await import('../../src/lib/import/run');
  const fix = (n: string) => ({ name: n, bytes: readFileSync(join(process.cwd(), 'tests', 'fixtures', n)) });
  const report = runImport(
    [
      fix('google-contacts.vcf'),
      fix('apple-contacts.vcf'),
      fix('linkedin-Connections.csv'),
      fix('telegram-result.json'),
      fix('outlook-contacts.csv'),
      { name: 'people.csv', bytes: Buffer.from(rows.join('\n')) },
    ],
    { apply: true, backup: false }
  );
  if (!report.ok) throw new Error('seeding failed: ' + JSON.stringify(report.files));
  console.log(`seeded ${report.after} contacts into ${db}`);
}

void main();
