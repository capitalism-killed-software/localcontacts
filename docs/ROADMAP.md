# Roadmap

**Goal.** Anyone clones this repo, runs two commands, points it at the contact exports
they already have (Google, Apple, Microsoft, Proton, LinkedIn, Telegram, a generic CSV,
…) and gets one clean, de-duplicated, searchable database. The repo also explains,
platform by platform, how to get those exports out, including the honest answer for chat
apps that do not export contacts at all.

Everything stays local. No accounts, no network calls, no AI enrichment of people.

## Where the importer stands (measured 2026-10-22)

Fake export files in the exact shape each platform produces, run through
`npm run import:sources`:

| Export | Format | Result |
|---|---|---|
| Google Contacts, vCard | vCard 3.0 | Imports. Second email and second phone dropped silently. |
| Google Contacts, CSV (current `First Name,Middle Name,…` layout) | CSV | Parsed as LinkedIn: names only, every email, phone, company and title lost, no warning. |
| Google Contacts, CSV (older `Name,Given Name,…` layout) | CSV | Zero rows, exit 0. |
| Outlook / Microsoft 365 / Outlook.com | CSV | Parsed as LinkedIn: name and company survive, email, phone, title lost. |
| Proton Contacts | vCard 4.0 | Imports. Second email dropped; `PREF=1` ignored; mis-tagged as Google. |
| Android / Samsung / older Outlook | vCard 2.1, quoted-printable | Names garbled (`Ren=C3=A9e`). |
| Apple (iCloud, macOS, iPhone) | vCard 3.0 | Imports. Extra emails and phones dropped. |
| Telegram data export | `result.json` | Silently ignored, exit 0. |
| LinkedIn `Connections.csv` | CSV with `Notes:` preamble | Imports correctly. |
| Any other CSV | CSV | Parsed as LinkedIn; usually names only or zero rows. |
| Signal, WhatsApp, Messenger, Teams, Discord | none | No contact export exists. Documented, not a bug. |

Other gaps:

- Unknown extensions are skipped without an error.
- `.csv` always means LinkedIn; there is no header sniffing.
- Single `email` and `phone` columns, so extra values are lost.
- Phones are stored as typed, so a phone can never act as a de-dup key. Telegram and
  other phone-only sources therefore can only create duplicates.
- vCard parser: no `QUOTED-PRINTABLE`/`CHARSET`, no `PREF=1`, no `TYPE=INTERNET,pref`.
- Source tag is guessed from the file name; the list page's source chips are a fixed
  list, so imports tagged anything else have no chip.
- `import:sources` writes immediately; the cleanup scripts are dry-run by default.
- Tests cover the legacy `import-csv.ts`, not the real importer.
- No export, no pagination.
- Next 14 and Vitest 2 are behind and carry audit findings.

## What done looks like

```bash
git clone … && cd localcontacts
npm install
npm run import -- ~/Downloads/contacts.vcf ~/Downloads/Connections.csv ~/Downloads/result.json
#   detects: vCard 3.0 (Google) · LinkedIn CSV · Telegram export
#   dry run: 1,204 new, 88 merged, 0 unknown  →  re-run with --apply
npm run dev
```

- `docs/exporting-your-contacts.md` tells every platform's user where the export button
  is and what file they get.
- Every supported format has a fake fixture under `tests/fixtures/` and a test proving the
  fields survive.
- Nothing is lost: extra emails and phones are stored.
- Unsupported files fail loudly with a hint.
- CI on Node 22 and 24.

## Phases

### 1. Importer core

Move parsing into a library under `src/lib/import/` shared by the CLI, the tests and a
later upload page:

```
src/lib/import/
  types.ts         IncomingContact { name, emails[], phones[], org, title, notes, urls[], connected_on, source }
  detect.ts        sniff(file) → vcard | google-csv | outlook-csv | linkedin-csv | telegram-json | generic-csv | unknown
  parsers/
    vcard.ts       2.1 / 3.0 / 4.0: unfold, QUOTED-PRINTABLE + CHARSET, PREF=1 and TYPE=pref, all EMAIL/TEL/URL, ORG;dept, N fallback, skip PHOTO
    google-csv.ts  both header layouts; E-mail N / Phone N; Organization Name/Title; Notes; Labels
    outlook-csv.ts E-mail Address/2/3, Mobile/Business/Home Phone, Job Title, Company, Notes
    linkedin-csv.ts current parser, moved
    telegram-json.ts contacts.list[] → name + phone
    generic-csv.ts any CSV with --map full_name=Name,email=Email,phone=Mobile, plus header guessing
  normalize.ts     email lowercase/trim; phone → E.164 with libphonenumber-js and a DEFAULT_COUNTRY
  merge.ts         match on any email → any phone → name; union emails, phones and sources
```

Schema, additive and idempotent like the existing migrations: `alt_emails`, `alt_phones`
(newline-separated), `phone_e164` (indexed, for matching), `urls`.

CLI `npm run import`: dry run by default, `--apply` to write; per-file line with detected
format, rows parsed and anything it will not keep; `--source=<tag>` per file, otherwise
inferred from the detected format, never the file name; unknown file is a non-zero exit
with a hint; keep `--tag-only`.

### 2. Tests and fixtures

Fake fixtures per format in `tests/fixtures/`; one test per parser and detector; merge
tests for email match, phone match across formats, name-only match, idempotent re-run,
`--tag-only`, unknown-file exit code. Retire the legacy importer and its test.

### 3. Docs for a stranger

README quick start and supported-formats table; `docs/exporting-your-contacts.md` with a
section per platform (Google, iCloud, macOS, iPhone, Outlook.com, Outlook desktop, Teams,
Proton, LinkedIn, Telegram, Android, Thunderbird, Yahoo, Fastmail/Nextcloud, Signal,
WhatsApp, Facebook, Slack, any CRM or spreadsheet), re-checked against each product's
current menus when written; a "what the importer keeps" section; `CONTRIBUTING.md` with
how to add a parser.

### 4. UI follow-through

Source chips from `SELECT DISTINCT` over the tags plus the untagged count; detail page
shows alternate emails, phones and URLs; `npm run export -- --format vcard|csv`;
server-side pagination; later, an `/import` page on the same library with a dry-run
summary and an Apply button.

### 5. Housekeeping

Upgrade Next and Vitest to clear the audit; drop the `node:sqlite` test shim if Vitest no
longer needs it.

## Decisions taken

- Command line first; browser upload later on the same library.
- `libphonenumber-js` for phone normalization: phone-only sources can only be merged by
  number, and correct normalization needs per-country rules.
- The keyword industry classifier stays, documented as optional.
