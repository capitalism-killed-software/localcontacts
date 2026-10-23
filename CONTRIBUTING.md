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
instead, as `tests/import/cli.test.ts` does).

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

The merge engine (`src/lib/import/merge.ts`) matches on any email, then any phone (unless the
emails disagree), then the normalised name. It fills gaps and never overwrites stored values.

## The interface

The book recreates Address Book from OS X 10.7/10.8. Colours and sizes in `src/app/globals.css`
were measured from screenshots of the original, so change them only to get closer to it.
`src/app/page.tsx` renders the book; the names list is a client component
(`src/components/NamesList.tsx`) fed by `/api/contacts`, drawing only visible rows with the maths
in `src/lib/window.ts`. URL parameters are parsed once, in `src/lib/context.ts`.

## Import page and photos

The import page (`src/components/ImportPanel.tsx`) posts files to `/api/import`, which calls the
same `runImport` as the command line; keep both on that one function. The endpoint rejects
requests from other origins because the app has no login. Photos are validated by their bytes
in `src/lib/photo.ts`; never trust a file name or a declared type, and never fetch a photo URL.

## Export

`src/lib/export/vcard.ts` and `csv.ts` write what the importer reads back.
`tests/export/cli.test.ts` imports every fixture, exports, re-imports and compares; keep it
passing when you touch either side.
