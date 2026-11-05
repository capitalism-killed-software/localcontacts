# Changelog

## Unreleased (1.1)

Everything can now be done from the book, without a terminal.

**Starting**
- An empty book greets you with three ways in: a guided import, 15 made-up sample people to try
  things on, and the export guide.
- Sample people are marked as made up, with a one-click way to remove them. Real contacts are
  never merged into them, and importing your own files offers to remove them first.
- A guided import (**More → Guided import…**): pick the services you use, and each one gets its
  export steps from the guide, a link to the service, and a box for its file. A box ticks itself
  once that service's contacts are in the book, so you can stop and come back; a file that
  doesn't look like that service's export gets a warning, not a refusal.

**Clean-up in the book** (**More → Clean up…**)
- Possible duplicates side by side, with what differs highlighted and why they are shown (same
  email, same phone, same name). Keep left, keep right (the same lossless merge as
  `merge:dupes`), or "Not the same person", which is remembered.
- Names that are an email address, and suggested industries, each as a preview you can untick.
- Each Apply saves one backup first and can be undone straight away. What to change is worked
  out again when you press Apply, so a page left open can't write a stale suggestion.

**Backups in the book** (**More → Backups…**)
- Every backup says what it was taken before ("Before importing google.vcf", "Before merging
  duplicates"), with its date, number of cards and size.
- Restore any backup: the book as it is is saved first, and the restore happens in one step on
  the running app, so nothing needs stopping and card numbers are never reused. Delete the ones
  you don't need.
- **Undo this import** right after an import, and "Undo the last import" on the Backups sheet,
  which warns when the book has changed since.

**Export in the book** (**More → Export…**)
- The whole book, a group or a search, as vCard (photos included) or as a spreadsheet (CSV),
  named after what is in it (`contacts-linkedin-2026-11-04.csv`).
- The CSV is Excel-safe: a cell starting with `=`, `+`, `-` or `@` gets an apostrophe in front,
  so a spreadsheet shows it as text instead of running it. Importing the file takes it off again.
  `npm run export` writes values exactly unless given `--excel`.

**About and updates**
- **More → About localcontacts**: the version, where the database and backups are, and a
  **Check for updates** button. It asks GitHub for the latest release only when pressed; nothing
  else ever leaves the computer, and in a production build the browser refuses connections to
  anywhere but the app and GitHub's API.

**Security**
- Reads of the API (exports, cards, photos, the names list) are refused when the browser says
  another site, or another app on this computer, asked for them.
- The service worker no longer handles requests to other sites.

**Updating and Docker**
- `npm run app` and the Windows launcher install and build again after an update (they used
  to build only the first time, so a `git pull` kept the old version running). `npm start`
  warns when the build is older than the code.
- A ready-made image for Intel and ARM, `ghcr.io/capitalism-killed-software/localcontacts`
  (`1.1.0`, `1.1`, `1`, `latest`), built and checked by CI for every release.
  `docker-compose.yml` uses it, so a home server no longer builds the app itself.

**Updating from 1.0**
- From a clone: `git pull`, then `npm run app` as before (or `npm install && npm run build`
  before `npm start`).
- With Docker: take the new `docker-compose.yml` (it uses the image), then
  `docker compose pull && docker compose up -d`. Or keep building it yourself with
  `docker compose up -d --build`.
- The database upgrades itself. Backups made by 1.0 are listed under Backups without a reason.

**For developers**
- The clean-up scripts are wrappers over `src/lib/cleanup/` and `src/lib/industry.ts`; exports
  go through `src/lib/export/book.ts`; backups live in `src/lib/backups.ts`.
- Browser tests have a second server with an empty book, for the first-run tests.

## 1.0.0 (2026-11-04)

The first public release.

**Importing**
- Reads vCard 2.1, 3.0 and 4.0 (Apple, Google, Proton, Android, Outlook, Thunderbird), Google
  Contacts CSV in both layouts, Outlook CSV, LinkedIn `Connections.csv`, Telegram `result.json`
  and any CSV with a header row; formats are recognised from the contents.
- Merges the same person across files by email, then phone (normalised, so formatting doesn't
  matter; only when the names could be the same person and the emails don't disagree), then
  name. Cards that one file keeps apart (different ids) stay apart unless an email matches. Keeps every email, phone and link and
  an embedded photo; never overwrites what is stored.
- An import page in the app with a dry-run summary, column choices for CSVs it can't read on its
  own, and a backup of the database before writing. The same import from the command line
  (`npm run import`).

**The book**
- The look of Address Book from OS X 10.7/10.8: groups (sources, industries, smart groups),
  names sorted by surname with A–Z sections, the card with its photo, edit mode with add and
  remove rows, Lion's ribbon to hide the groups. One page at a time on a phone.
- Arrow keys, Home, End and the page keys move between cards; typing a name with the list
  focused jumps to it.
- Fast with large address books: the names list loads once and draws only what is on screen.

**Exporting**
- vCard 3.0 and CSV from the command line (`npm run export`) with the book's filters, and an
  Export vCard button on each card. Exports carry each card's id and import back unchanged,
  checked on a real 7,000-contact address book.

**Running it**
- Any OS with Node 22.13 or newer; Docker; an installable web app with its own icon; launchers
  for a window of its own on macOS, Linux and Windows.
- Answers only known host names and accepts writes only from its own pages; no network calls,
  no telemetry, no AI.

**Checked by black-box testing before release**
- `npm start`, `npm run app` and the launchers listen on this computer only (127.0.0.1), so
  nobody else on the network can open the book. `CONTACTS_LISTEN` picks another address on
  purpose; the `HOSTNAME` setting DEPLOY.md described never worked.
- Two different people with the same name are no longer fused into one card: a name match is
  refused when the cards disagree on both their emails and their phones. When a name match does
  merge, a different title or company is kept in the note instead of being dropped.
- `npm run merge:dupes` merges the way an import does, so the dropped card's further emails,
  phones, links, photo and groups are kept; disagreeing values go into the note. It saves a
  backup first and refuses chained or repeated pairs, which used to delete a contact outright.
- Every write is checked before it runs, in one place: a foreign `Origin` (including one backed
  by a forged `X-Forwarded-Host`) or a cross-site request without one is refused with 403. No
  other site may frame the book (`X-Frame-Options`, `frame-ancestors`), which a disguised page
  could otherwise use to click its buttons.
- Host headers that aren't a plain host and port (`localhost:abc`, `localhost@evil.example`) are
  refused. Card ids in links are plain decimal numbers only, so `?id=1e3` no longer opens card
  1000. An import over 100 MB is refused from its size before it is parsed, and the import page's messages name
  the real problem (a tag over 40 characters, an empty file).
- Exports round-trip completely: groups, industry and the last-contacted date come back from
  both vCard and CSV, a card without a name stays without one, and importing an export into the
  book it came from changes nothing. Notes with Windows line breaks used to double on every
  export and re-import; line breaks are now stored as `\n`, including notes already in the
  database. CSV imports also read Industry and Last Contacted columns.
- Files are read more faithfully: a CSV whose first row leaves trailing cells out no longer
  loses those columns for every row; repeated headers (two Email columns) are both read;
  semicolon- and tab-separated files are recognised. Text that isn't UTF-8 (Excel and classic
  Outlook often write Windows-1252, vCards may name a `CHARSET`) is decoded instead of becoming
  "�", with a note in the summary, and a vCard line folded in the middle of a character is put
  back together.
- `npm run clean:names` no longer loses data: an address that appears only in a name is kept as
  an email, a name is never replaced by a different address, "Ann @ Acme" moves Acme into an
  empty company field (or is left alone when the card names another company), and quoted
  `"Name" <address>` forms are tidied. It and `classify:industry` save a backup first, answer
  `--help` and refuse unknown options.
- vCard quirks: an Android AGENT card embedded in another no longer replaces its owner; a card
  without `END:VCARD` (a file cut off) is kept with a warning; a NUL no longer cuts a name short;
  Apple and vCard 4 group cards are skipped instead of becoming empty contacts; every property
  that isn't kept is listed in the dry run; base64-encoded names and vCard 4's preferred name
  are read; social profile links are kept.
- Outlook CSV keeps the Pager, ISDN, Callback, Radio, TTY/TDD and Assistant's phone columns.
  Email values are cleaned up (`mailto:` dropped, several addresses in a cell split); a value
  with no address in it is kept as it was written. A card from one of our own exports is matched first to the
  card it came from (by its id, when the name agrees), so importing an export into the book it
  came from changes nothing even when two cards share an email, and an untagged card stays
  untagged. A nameless Telegram entry merges with the named card
  that has its number, and a nameless card on a number several people share is not merged into
  one of them. Refused files get a reason that fits: a chat export, damaged JSON, an unclosed
  quote in a CSV, a binary file.
- Command line and import page: source tags follow one rule everywhere (the command line used
  to store spaces, commas and anything else), are stored in lower case so "Work" and "work" are
  one group, and can't be `all` or `untagged`; an industry of "none" means none. `--country`
  must be a real country code. A folder passed as a file, a bad `--map`, or `--out` in a missing
  folder get a message instead of a stack trace. The summary counts matches that bring nothing
  new, and the import page shows merges within the files. Typing a tag no longer swallows the
  first click on Import. Backups are named in local time, a second one in the same second sorts
  after the first, a dry run no longer creates an empty database file, and the pages show where
  the database really is.
- Search ignores case in every script and ignores accents ("nunez" finds Núñez, "élodie" finds
  Élodie), matches each word on its own and in any order ("wendell quarry"), and finds a phone
  number however it is typed ("3035550177" and "+1 303 555 0177" find "(303) 555-0177"). The
  export's `--q` is the same search. Names starting with Ø, Ł, Æ and similar letters are filed
  under their plain letter instead of "#".
- A photo must be a whole image, not just start like one: a file cut off after its first bytes,
  or another file given an image's signature, is refused with a message (in edit mode and on
  import) instead of being saved and shown as a broken image.
- The book: Done works once, so a double-click no longer makes two cards; leaving a card with
  unsaved changes (a name, a group, the sort menu, Import…) asks first, and Cancel still just
  cancels; a name of only spaces, or a phone without digits, is caught in the form instead of
  showing the error page; the same email in another case or the same number in another format
  is saved once. Type-to-jump keeps working after clicking a name in a long list. The search box
  follows Back and Forward. Hidden groups no longer flash on each load. A company's own card
  ("Acme Plumbing") is filed under its first letter and exported as a company.
