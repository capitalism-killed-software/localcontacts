# localcontacts

One local, searchable database for the contacts you have scattered across Google, Apple,
Outlook, Proton, LinkedIn and the rest. Runs on your machine. Nothing leaves it.

Import your exports, let the importer de-duplicate and merge them, then search, sort,
filter, edit and fill the gaps.

## Status

Early, and honest about it. Today the importer handles:

| Source | File | Works |
|---|---|---|
| Apple (iCloud, macOS Contacts, iPhone) | `.vcf` (vCard 3.0) | yes |
| Google Contacts | `.vcf` export | yes |
| Proton Contacts | `.vcf` (vCard 4.0) | yes |
| LinkedIn | `Connections.csv` | yes |
| Google Contacts | `.csv` export | **not yet**: names only, email and phone are lost |
| Outlook / Microsoft 365 | `.csv` export | **not yet**: names only |
| Telegram | `result.json` | **not yet**: ignored |
| Android (vCard 2.1, quoted-printable) | `.vcf` | **not yet**: names come out garbled |
| Any other CSV | `.csv` | **not yet** |

Only the first email and phone of a vCard are kept for now. The fixes, in order, are in
[docs/ROADMAP.md](docs/ROADMAP.md).

## Requirements

Node.js 22.13 or newer (24 LTS recommended). The app uses Node's built-in `node:sqlite`,
so there is no native build step. Node prints an "SQLite is an experimental feature"
warning on startup; it is harmless.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

The database is created at `data/contacts.db` on first start. To look around with fake
data before importing your own:

```bash
npm run import -- seed/sample-contacts.csv
```

## Import your own contacts

1. Export from each platform. Menus move, so check your app if a path differs:
   - **Google Contacts:** contacts.google.com → Export → vCard
   - **Apple:** icloud.com/contacts → select all → Export vCard; or macOS Contacts → File → Export → Export vCard
   - **Proton:** Settings → Contacts → Export contacts
   - **LinkedIn:** Settings & Privacy → Data privacy → Get a copy of your data → Connections (arrives by email)
   - **Signal and WhatsApp** do not export contacts; they read your phone's address book, so export that (Apple or Android).
2. Put the files in `imports/` (gitignored) or anywhere outside the repo.
3. Back up `data/contacts.db`, then run:

```bash
npm run import:sources -- imports/contacts.vcf imports/Connections.csv
```

`import:sources` writes immediately (a dry-run mode is on the roadmap). It is safe to
re-run: a person matched by email, then by name, is kept once and missing fields are
filled in rather than duplicated. `--source=<tag>` labels every file in the run; without
it the tag is guessed from the file name. `--tag-only` updates labels on matching rows and
never inserts.

## Cleanup scripts

All three are dry-run by default; add `--apply` to write.

```bash
npm run clean:names       [-- --apply]           # tidy names that are really email addresses
npm run merge:dupes -- 12:34 56:78 [--apply]     # merge explicit keepId:dropId pairs, losslessly
npm run classify:industry [-- --apply]           # keyword rules over company + title; fills blanks only
```

## Privacy

Everything is a local SQLite file in `data/`, which is gitignored along with `imports/`
and any `.vcf`, `.csv` or `.json` at the repo root. No network calls, no accounts, no AI.

## Test

```bash
npm test
npm run typecheck
```

## Stack

Next.js 14 (App Router, TypeScript), Tailwind CSS, `node:sqlite`.

## Layout

- `src/app/page.tsx`: list with search, sortable columns, completeness, source and industry filters
- `src/app/contacts/new/page.tsx`: add
- `src/app/contacts/[id]/page.tsx`: detail, edit, delete
- `src/lib/db.ts`: SQLite connection, schema and migrations
- `src/lib/contacts.ts`: queries
- `scripts/`: import and cleanup tools

## Licence

MIT. See [LICENSE](LICENSE).
