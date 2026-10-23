# Roadmap

**Goal.** Anyone clones this repo, runs two commands, points it at the contact exports
they already have (Google, Apple, Microsoft, Proton, LinkedIn, Telegram, a generic CSV,
…) and gets one clean, de-duplicated, searchable database. The repo also explains,
platform by platform, how to get those exports out, including the honest answer for chat
apps that do not export contacts at all.

Everything stays local. No accounts, no network calls, no AI enrichment of people.

## Done

**Phases 1 and 2 (2026-10-22).** The importer is a library under `src/lib/import/`
with content-based format detection, a parser per format (vCard 2.1/3.0/4.0, Google CSV in
both layouts, Outlook CSV, LinkedIn, Telegram, generic CSV with `--map`), phone
normalisation through `libphonenumber-js`, and a merge engine that matches on any email,
then any phone, then name. Every email, phone and link is kept (`alt_emails`, `alt_phones`,
`urls` columns). The CLI is a dry run by default, labels files with an inferred or given
source tag, and stops with a hint on anything it cannot read. Fake fixtures for every format
live in `tests/fixtures/` with detector, parser, merge and end-to-end CLI tests. The list
page's source chips are built from the tags actually present. The detail page shows the
extra emails, phones, links and sources.

Before this, the measured state was: Google CSV and Outlook CSV imported names only, the
older Google CSV layout and Telegram imported zero rows while reporting success, vCard 2.1
names came out garbled, every `.vcf` was tagged as Google, and only the first email and
phone of a card were kept.

A `phone_e164` column was considered and not added: matching normalises phones at import
time and nothing in the UI needs the canonical form yet.

**The Address Book interface (2026-10-22).** The list, detail and form pages became one book
at `/`, styled after Address Book on OS X 10.7/10.8 from pixel measurements of the original:
Groups and Names on the left page, the card on the right, Lion's ribbon toggling the groups,
A–Z sections with bold surnames, the framed photo square, the label column, the textured
buttons, and an edit mode with ⊖ ⊕ rows that finally lets the extra emails, phones and links
be edited by hand. One page at a time below 900px. Old `/contacts/…` links redirect.

**Run it as an app (2026-10-22).** Web app manifest, icons and a no-op service worker so any
browser can install it; `npm run app` opens a chromeless window and stops the server when it
closes; `scripts/app/install-desktop.sh` makes a `.app` on macOS and a launcher entry on Linux;
`launch.cmd` for Windows. CI now runs on Ubuntu, macOS and Windows with Node 22 and 24.

**Measured with 7,000 contacts:** the whole page is 2.1 MB and renders in about 0.3 s on
localhost; a card click fetches a 1.4 MB server-components payload in about 0.1 s, because the
names list travels with every card. Fine for one person on one machine; pagination (below)
is what would change it.

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

### 1. Importer core, 2. Tests and fixtures

Done, see above.

### 3. Docs for a stranger

README, `docs/ABOUT.md` (why it exists) and `docs/DEPLOY.md` are written. Still to do:
`docs/exporting-your-contacts.md` with a section per platform (Google, iCloud, macOS,
iPhone, Outlook.com, Outlook desktop, Teams, Proton, LinkedIn, Telegram, Android,
Thunderbird, Yahoo, Fastmail/Nextcloud, Signal, WhatsApp, Facebook, Slack, any CRM or
spreadsheet), each step checked against the product's current menus with a screenshot
where it helps; and `CONTRIBUTING.md` with how to add a parser (fixture, parser, detector
rule, test).

### 4. UI follow-through

`npm run export -- --format vcard|csv` from the same normalised model; server-side pagination
or a virtualised names list (see the 7,000-row numbers above); a photo on the card; later, an
`/import` page on the same library with a dry-run summary and an Apply button. Editing of the
extra emails, phones and links is done.

### 5. Housekeeping

Upgrade Next and Vitest to clear the audit; drop the `node:sqlite` test shim if Vitest no
longer needs it.

## Decisions taken

- Command line first; browser upload later on the same library.
- `libphonenumber-js` for phone normalization: phone-only sources can only be merged by
  number, and correct normalization needs per-country rules.
- The keyword industry classifier stays, documented as optional.
