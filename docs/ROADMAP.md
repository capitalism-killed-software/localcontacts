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

**Export, a lighter names list, guides and upgrades (2026-10-22).** `npm run export` writes
vCard 3.0 or CSV with the book's filters, and each card has an Export vCard button; every
fixture survives an export and re-import (`tests/export/cli.test.ts`). The names list is now
fetched once per search, group or sort from `/api/contacts` and only the rows on screen are
drawn. `docs/exporting-your-contacts.md` covers each platform with links to the vendors' help
pages; `CONTRIBUTING.md` explains how to add a format. Next 16, React 19, Vitest 5, csv-parse 7
and TypeScript 6, Tailwind removed: `npm audit` reports nothing. Fixed on the way: vCard
unescaping of `\;` and `\\n`, CSV detection when the first row has a multi-line cell, numbered
URL columns, and a merge that joined two people with different emails on a shared office phone.

**Measured with 7,000 contacts** (production build, localhost):

| | Before | Now |
|---|---|---|
| Full page | 2.1 MB | 27 KB |
| A card click | 1.4 MB | 12 KB, about 20 ms |
| Names list | in every response | 172 KB once, when search, group or sort changes or after a save |
| Rows in the page | 7,000 | about 40 |

Trade-off: the browser's own find (Ctrl-F) only sees the names on screen; the search box
searches everything.

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

### 3. Docs for a stranger, 4. Export and the names list, 5. Housekeeping

Done, see above. Screenshots in the export guide were dropped: they need real accounts on each
platform, so the guide links to each vendor's help page instead, with the date it was checked.

### Import page, photos and arrow keys (2026-10-23)

Done. **Import…** opens a sheet in the book: drop files, read the dry-run summary, press
Import; it runs the same library as the command line (`src/lib/import/run.ts`), backs the
database up to `data/backups/` first, and only accepts uploads from the app's own pages.
Card photos come from vCard `PHOTO` (3.0, 2.1 and 4.0 data URIs; links are not fetched), are
checked by their bytes (JPEG, PNG, GIF, WebP, up to 2 MB), can be chosen or removed in edit mode,
and go back out in vCard exports. Arrow keys, Home, End and the page keys move between cards.

### Release preparation (2026-10-23)

Done: browser tests in CI (`npm run test:e2e`), a tester checklist (`docs/TESTING.md`), column
choices for CSVs on the import page, the export guide served in the app at `/help/export`,
type-to-jump in the names list, host-name allowlist against DNS rebinding
(`CONTACTS_ALLOWED_HOSTS`), safe links, error pages, `SECURITY.md`, `CHANGELOG.md`, issue
templates, Dependabot. A trial on a real 7,000-contact address book led to stricter phone
matching and card ids in exports; both export formats now round-trip it exactly.

### Black-box testing (2026-11-04)

Three testers worked only from these docs, the running app and the command line, with made-up
data: one in the browser, one against the HTTP surface, one feeding the importer and exporter
crafted files. They found 62 issues (52 once duplicates were merged); every one was reproduced
before it was fixed, and each fix has a test that failed first. The serious ones: `npm start`
listened on every network address (now 127.0.0.1 unless `CONTACTS_LISTEN` says otherwise), two
people with the same name were fused into one card, `merge:dupes` and `clean:names` could lose
data, notes doubled on every export and re-import, and Windows-1252 files lost their accents.
Also fixed: writes checked in one place and framing refused, exports that round-trip groups,
industry and dates, more export quirks read or reported, search without case or accents and by
phone digits, whole images only, and a dozen smaller things in the book and the command line.
`CHANGELOG.md` lists them.

Left as known limits: the importer keeps one name string, so a vCard's structured name (N) is not
stored and exports derive it (company cards excepted); an import is held in memory while it is
checked (`SECURITY.md`); industry groups are case-sensitive.

### Next

- Hand testing on macOS, Windows and Linux with `docs/TESTING.md`, including the first run of
  `scripts/app/install-desktop.sh` on a Mac. Fix what it finds, each with a test.
- Release 1.0.0: date the changelog, tag and publish the GitHub release (the repository went
  public on 2026-11-04).
- After 1.0: installers that bundle Node so people need not install it; more import formats if
  people ask (LDIF, Zoho); re-check the export guide against the vendors' pages every few months.

## Decisions taken

- Command line first; browser upload later on the same library.
- `libphonenumber-js` for phone normalization: phone-only sources can only be merged by
  number, and correct normalization needs per-country rules.
- The keyword industry classifier stays, documented as optional.
