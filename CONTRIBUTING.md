# Contributing

Thanks for helping. localcontacts is small on purpose; these notes keep it that way.

## Ground rules

- **Local only.** The app makes no network calls: no analytics, no update checks, no hosted
  services. Contributions that add one will not be merged.
- **No AI on people's data.** Nothing reads, enriches, classifies or summarises contacts with a
  model. Deterministic rules (like the keyword industry classifier) are fine.
- **Fake data only.** Fixtures, screenshots, issues and examples use invented people with
  `example.com` addresses and 555 numbers. Never commit a real export, even a small one.
- **Plain commits.** Write commit messages a person would write: what changed and why, in
  sentences. One logical change per commit.

## Setup

Node.js 22.13 or newer.

```bash
npm install
npm run dev          # http://localhost:3000, database in data/contacts.db
npm test             # Vitest
npm run typecheck    # generates Next's route types, then tsc
npm run build
```

Point the app at a throwaway database while you work:

```bash
CONTACTS_DB_PATH=/tmp/try.db npm run import -- --apply tests/fixtures/*.vcf
CONTACTS_DB_PATH=/tmp/try.db npm run dev
```

CI runs typecheck and tests on Ubuntu, macOS and Windows with Node 22 and 24, so avoid
shell-specific paths and `node_modules/.bin` in tests (spawn `node node_modules/tsx/dist/cli.mjs`
instead, as `tests/import/cli.test.ts` does). Suites that spawn the scripts are slow on some CI
runners: give their `describe` (and any setup hook that spawns) `{ timeout: 60_000 }`.

Every bug fix comes with a test that fails without the fix: a unit test in `tests/`, or a browser
test in `tests/e2e/` for what only the page shows.

## Adding an import format

1. **A fixture first.** Make a small fake file in the platform's exact shape (headers, encoding,
   quirks) in `tests/fixtures/`. A real export with every value replaced is the best template.
2. **A parser** in `src/lib/import/parsers/`, returning `ParseResult` from
   `src/lib/import/types.ts`: one `IncomingContact` per person, every email, phone and link it
   has, warnings for anything it drops, and a `sourceHint` tag.
3. **Detection** in `src/lib/import/detect.ts`, from the file's contents, never its name. Add the
   format to `Format` and `FORMAT_LABELS`.
4. **Wire it** into `parseText` and `defaultSource` in `src/lib/import/index.ts`.
5. **Tests:** a detection case in `tests/import/detect.test.ts`, field-by-field parser tests,
   and if it can share people with other formats, a merge case.
6. **Docs:** the table in `README.md` and a section in `docs/exporting-your-contacts.md` with the
   export steps and a link to the vendor's help page.

The merge engine (`src/lib/import/merge.ts`) matches a card from our own export to the card its
id names first (`UID:localcontacts-12`, when the name agrees); then on any email; then on any
phone, only when the names could be the same person and the emails don't disagree; then on the
normalised name, unless the two cards disagree on both their emails and their phones. It fills
gaps and never overwrites stored values; a different title or company on a name match goes into
the note. Source tags follow `src/lib/import/tags.ts` everywhere (import page, command line, our
own exports).

## The interface

The book recreates Address Book from OS X 10.7/10.8. Colours and sizes in `src/app/globals.css`
were measured from screenshots of the original, so change them only to get closer to it.
`src/app/page.tsx` renders the book; the names list is a client component
(`src/components/NamesList.tsx`) fed by `/api/contacts`, drawing only visible rows with the maths
in `src/lib/window.ts`. URL parameters are parsed once, in `src/lib/context.ts`.

## Import page and photos

The import page (`src/components/ImportPanel.tsx`) posts files to `/api/import`, which calls the
same `runImport` as the command line; keep both on that one function. The app has no login, so
every write (card saves, deletes, imports) is checked once, in `src/proxy.ts`: the host must be
allowed and the request must come from the app's own pages (`isWriteFromApp` in
`src/lib/hosts.ts`). Photos are validated by their bytes in `src/lib/photo.ts`, and must be whole
images (`isWholeImage`); never trust a file name or a declared type, and never fetch a photo URL.

Search and name sorting compare text through `src/lib/fold.ts` (no case, no accents, ø → o and
the like); it is also registered as an SQL function when the database opens.

## Export

`src/lib/export/vcard.ts` and `csv.ts` write what the importer reads back.
`tests/export/cli.test.ts` imports every fixture, exports, re-imports and compares; keep it
passing when you touch either side.
