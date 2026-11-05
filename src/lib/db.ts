import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Path override (mainly for tests). `:memory:` selects an in-memory DB.
export function dbPath(): string {
  const override = process.env.CONTACTS_DB_PATH;
  if (override) return override === ':memory:' ? ':memory:' : resolve(override);
  return resolve(process.cwd(), 'data', 'contacts.db');
}

declare global {
  // eslint-disable-next-line no-var
  var __contactsDb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  const path = dbPath();
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS contacts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name     TEXT NOT NULL,
      title         TEXT,
      company       TEXT,
      email         TEXT,
      phone         TEXT,
      notes         TEXT,
      connected_on  TEXT,
      last_contacted TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_full_name ON contacts(full_name);
    CREATE INDEX IF NOT EXISTS idx_contacts_company   ON contacts(company);
    CREATE INDEX IF NOT EXISTS idx_contacts_email     ON contacts(email);
  `);
  // Migrations for columns added after a database was first created
  // (CREATE TABLE IF NOT EXISTS won't alter an existing table). Idempotent —
  // each ALTER is a no-op once its column is present.
  const cols = db.prepare(`PRAGMA table_info(contacts)`).all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('last_contacted')) {
    db.exec(`ALTER TABLE contacts ADD COLUMN last_contacted TEXT`);
  }
  // `sources`: comma-separated origin tags (linkedin, iphone, google-personal,
  // google-work). A contact merged from several files accumulates all of them.
  if (!names.has('sources')) {
    db.exec(`ALTER TABLE contacts ADD COLUMN sources TEXT`);
  }
  // `industry`: free-text category, seeded by the heuristic classifier and
  // editable per contact.
  if (!names.has('industry')) {
    db.exec(`ALTER TABLE contacts ADD COLUMN industry TEXT`);
  }
  // Extra values the importer keeps so nothing from an export is lost:
  // newline-separated lists of further emails, phones and links.
  for (const col of ['alt_emails', 'alt_phones', 'urls']) {
    if (!names.has(col)) db.exec(`ALTER TABLE contacts ADD COLUMN ${col} TEXT`);
  }
  // The card photo: the image bytes and their type. Only `photo_type` is read
  // with the rest of a contact; the bytes are fetched on their own.
  if (!names.has('photo')) db.exec(`ALTER TABLE contacts ADD COLUMN photo BLOB`);
  if (!names.has('photo_type')) db.exec(`ALTER TABLE contacts ADD COLUMN photo_type TEXT`);
  // Notes are stored with \n line breaks; older versions kept \r\n from Windows
  // files and from the edit form, which doubled the note on every export and
  // re-import. Cheap and idempotent.
  db.exec(`UPDATE contacts SET notes = replace(replace(notes, char(13) || char(10), char(10)), char(13), char(10))
           WHERE instr(notes, char(13)) > 0`);
  return db;
}

export function getDb(): DatabaseSync {
  if (!global.__contactsDb) {
    global.__contactsDb = open();
  }
  return global.__contactsDb;
}

// Closes and clears the cached connection. Used by tests to get a fresh DB;
// harmless in normal runtime.
export function closeDb(): void {
  if (global.__contactsDb) {
    global.__contactsDb.close();
    global.__contactsDb = undefined;
  }
}
