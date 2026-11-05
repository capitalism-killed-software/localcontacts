import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fixturePath } from './helpers';

// Runs the real CLI (scripts/import.ts via tsx) against a temp database.

const ROOT = process.cwd();
// Run tsx through node rather than node_modules/.bin, which is a .cmd shim on Windows.
const TSX_CLI = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

let workdir: string;
let dbPath: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'localcontacts-cli-'));
  dbPath = join(workdir, 'test.db');
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

type Run = { status: number; out: string };

function run(...args: string[]): Run {
  try {
    const out = execFileSync(process.execPath, [TSX_CLI, 'scripts/import.ts', ...args], {
      cwd: ROOT,
      env: { ...process.env, CONTACTS_DB_PATH: dbPath },
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, out };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { status: e.status, out: `${e.stdout}\n${e.stderr}` };
  }
}

function query<T>(sql: string): T[] {
  const db = new DatabaseSync(dbPath);
  try {
    return db.prepare(sql).all() as T[];
  } finally {
    db.close();
  }
}
const count = () => query<{ c: number }>('SELECT COUNT(*) AS c FROM contacts')[0].c;

// Each test spawns the real scripts through tsx, which is slow on some CI runners.
describe('import CLI', { timeout: 60_000 }, () => {
  it('dry-runs by default and writes nothing', () => {
    const r = run(fixturePath('google-contacts.vcf'));
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/vCard, 2 contacts, tagged "vcard"/);
    expect(r.out).toMatch(/New contacts\s+: 2/);
    expect(r.out).toMatch(/Dry run: nothing written/);
    // Not even an empty database file is created.
    expect(existsSync(dbPath)).toBe(false);
  });

  it('writes with --apply, merges across formats, and is idempotent', () => {
    const r1 = run('--apply', fixturePath('google-contacts.vcf'), fixturePath('linkedin-Connections.csv'), fixturePath('telegram-result.json'));
    expect(r1.status).toBe(0);
    expect(r1.out).toMatch(/Written: 3 inserted, 0 updated/);
    // Ada (vcf + linkedin + telegram) merged into one; Grace; Mary (linkedin + telegram) merged.
    expect(count()).toBe(3);
    const ada = query<{ email: string; alt_emails: string; phone: string; urls: string; sources: string; connected_on: string }>(
      "SELECT email, alt_emails, phone, urls, sources, connected_on FROM contacts WHERE full_name = 'Ada Lovelace'"
    )[0];
    expect(ada.email).toBe('ada@example.com');
    expect(ada.alt_emails).toBe('ada.home@example.com');
    expect(ada.phone).toBe('+1 202-555-0101');
    expect(ada.urls).toBe('https://www.linkedin.com/in/ada-example');
    expect(ada.sources).toBe('linkedin,telegram,vcard');
    expect(ada.connected_on).toBe('2025-09-16');

    const r2 = run('--apply', fixturePath('google-contacts.vcf'), fixturePath('linkedin-Connections.csv'));
    expect(r2.status).toBe(0);
    expect(r2.out).toMatch(/New contacts\s+: 0/);
    expect(r2.out).toMatch(/Written: 0 inserted, 0 updated/);
    expect(count()).toBe(3);
  });

  it('labels files with --source and infers the rest', () => {
    const r = run('--apply', '--source=work', fixturePath('outlook-contacts.csv'), '--source=', fixturePath('proton-contacts.vcf'));
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/Outlook CSV, 2 contacts, tagged "work"/);
    expect(r.out).toMatch(/vCard, 2 contacts, tagged "proton"/);
    const tags = query<{ sources: string }>('SELECT sources FROM contacts ORDER BY full_name').map((r) => r.sources);
    expect(tags).toEqual(['proton,work', 'proton,work']);
  });

  it('stops on an unrecognised file with a hint and writes nothing', () => {
    const r = run('--apply', fixturePath('google-contacts.vcf'), fixturePath('not-contacts.txt'));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/not-contacts\.txt: not a contact export/);
    expect(r.out).toMatch(/Nothing was written/);
    expect(existsSync(dbPath)).toBe(false); // it never even opened the database
  });

  it('applies --map to a generic CSV and --tag-only to an existing database', () => {
    expect(run('--apply', fixturePath('generic-crm.csv')).status).toBe(0);
    expect(count()).toBe(2);
    const r = run('--apply', '--tag-only', '--source=crm', fixturePath('generic-crm.csv'), fixturePath('android-v21.vcf'));
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/Skipped \(tag-only\)\s+: 1/);
    expect(count()).toBe(2);
    expect(query<{ sources: string }>("SELECT sources FROM contacts WHERE full_name = 'Ada Lovelace'")[0].sources).toBe('crm,csv');
  });

  it('rejects an unknown option and a bad --map', () => {
    expect(run('--bogus', fixturePath('generic-crm.csv')).status).toBe(1);
    const r = run('--map=nickname=Foo', fixturePath('generic-crm.csv'));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/unknown field/);
  });
});

// Each test spawns the real scripts through tsx, which is slow on some CI runners.
describe('import CLI mistakes', { timeout: 60_000 }, () => {
  it('refuses bad tags, countries and maps, and folders, with a message instead of a stack trace', () => {
    for (const [args, message] of [
      [['--source=Work Friends'], /may only use letters/],
      [['--source=clients,2024'], /may only use letters/],
      [['--source=untagged'], /built-in group/],
      [['--country=XX'], /--country=XX: not a two-letter country code/],
      [['--map=bad'], /bad --map entry "bad"/],
      [['--map=fullname=Name'], /unknown field "fullname"/],
    ] as const) {
      const r = run(...args, fixturePath('generic-crm.csv'));
      expect(r.status, args.join(' ')).toBe(1);
      expect(r.out, args.join(' ')).toMatch(message);
      expect(r.out, args.join(' ')).not.toMatch(/\n\s+at /);
    }
    const folder = run(join(ROOT, 'tests', 'fixtures'));
    expect(folder.status).toBe(1);
    expect(folder.out).toMatch(/is a folder/);
  });

  it('stores tags in lower case and counts matches that bring nothing new', () => {
    expect(run('--apply', '--source=Work', fixturePath('google-contacts.vcf')).status).toBe(0);
    expect(query<{ sources: string }>('SELECT DISTINCT sources FROM contacts')).toEqual([{ sources: 'work' }]);
    const again = run('--source=work', fixturePath('google-contacts.vcf'));
    expect(again.out).toMatch(/Already there, no news : 2/);
    expect(again.out).toMatch(/vCard, 2 contacts/);
  });
});
