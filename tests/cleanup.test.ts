import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { proposeNameFix, type NameRow } from '../src/lib/clean-names';

const row = (over: Partial<NameRow>): NameRow => ({ full_name: 'X', email: null, alt_emails: null, company: null, ...over });

describe('proposeNameFix', () => {
  it('derives a person’s name from an address and strips wrappers', () => {
    expect(proposeNameFix(row({ full_name: 'sam.ortega@example.com', email: 'sam.ortega@example.com' }))).toEqual({ name: 'Sam Ortega', addEmails: [], company: null });
    expect(proposeNameFix(row({ full_name: '(no name)', email: 'ada.lovelace@example.com' }))?.name).toBe('Ada Lovelace');
    expect(proposeNameFix(row({ full_name: '"Frank Fish" <frank@example.com>', email: 'frank@example.com' }))).toEqual({ name: 'Frank Fish', addEmails: [], company: null });
    expect(proposeNameFix(row({ full_name: 'Ada (@countess) Lovelace' }))?.name).toBe('Ada Lovelace');
  });

  it('never loses an address that appears only in the name', () => {
    // A different address in the name is not replaced by the stored one.
    expect(proposeNameFix(row({ full_name: 'carol@example.com', email: 'dave@example.com' }))).toBeNull();
    expect(proposeNameFix(row({ full_name: 'Real Name (real@example.org)', email: 'other@example.com' }))).toEqual({
      name: 'Real Name', addEmails: ['real@example.org'], company: null,
    });
  });

  it('cuts "Name @ Company" only when the company is free or the same', () => {
    expect(proposeNameFix(row({ full_name: 'Ann @ Acme' }))).toEqual({ name: 'Ann', addEmails: [], company: 'Acme' });
    expect(proposeNameFix(row({ full_name: 'Ann @ Acme', company: 'ACME' }))).toEqual({ name: 'Ann', addEmails: [], company: null });
    expect(proposeNameFix(row({ full_name: 'Ann @ Acme', company: 'Other Co' }))).toBeNull();
  });
});

describe('clean-up scripts', () => {
  const ROOT = process.cwd();
  const TSX_CLI = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  let workdir: string;
  let dbPath: string;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'localcontacts-cleanup-'));
    dbPath = join(workdir, 'contacts.db');
    execFileSync(process.execPath, [TSX_CLI, '-e', "require('./src/lib/db').getDb()"], { cwd: ROOT, env: { ...process.env, CONTACTS_DB_PATH: dbPath } });
    const db = new DatabaseSync(dbPath);
    const add = db.prepare('INSERT INTO contacts (full_name, email, company, title) VALUES (?, ?, ?, ?)');
    add.run('Real Name (real@example.org)', 'other@example.com', null, null);
    add.run('Ann @ Acme', null, null, null);
    add.run('Bea Banker', 'bea@example.com', 'First National Bank', 'Teller');
    db.close();
  });
  afterEach(() => rmSync(workdir, { recursive: true, force: true }));

  const run = (script: string, ...args: string[]) => {
    try {
      return { status: 0, out: execFileSync(process.execPath, [TSX_CLI, `scripts/${script}.ts`, ...args], { cwd: ROOT, env: { ...process.env, CONTACTS_DB_PATH: dbPath }, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (err) {
      const e = err as { status: number; stdout: string; stderr: string };
      return { status: e.status, out: `${e.stdout}\n${e.stderr}` };
    }
  };
  const all = () => {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const r = db.prepare('SELECT full_name, email, alt_emails, company, industry FROM contacts ORDER BY id').all();
    db.close();
    return r;
  };

  it('clean:names keeps every address, fills the company, and backs up first', () => {
    const r = run('clean-names', '--apply');
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/Backup saved first: .*contacts-.*\.db/);
    expect(readdirSync(join(workdir, 'backups'))).toHaveLength(1);
    expect(all().slice(0, 2)).toEqual([
      { full_name: 'Real Name', email: 'other@example.com', alt_emails: 'real@example.org', company: null, industry: null },
      { full_name: 'Ann', email: null, alt_emails: null, company: 'Acme', industry: null },
    ]);
  });

  it('classify:industry backs up first; both answer --help and refuse unknown options', () => {
    const r = run('classify-industry', '--apply');
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/Backup saved first/);
    expect(all()[2]).toMatchObject({ industry: 'Finance / Banking' });
    for (const script of ['clean-names', 'classify-industry']) {
      expect(run(script, '--help')).toMatchObject({ status: 0, out: expect.stringMatching(/^Usage:/) });
      expect(run(script, '--aply')).toMatchObject({ status: 1, out: expect.stringMatching(/Unknown option --aply/) });
    }
  });
});
