# Changelog

## 1.0.0 (unreleased)

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

**Fixed after black-box testing**
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
  1000. An import over 100 MB is refused before it is read, and the import page's messages name
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
  Email values are cleaned up (`mailto:` dropped, several addresses in a cell split, Exchange
  paths and other non-addresses left out). A nameless Telegram entry merges with the named card
  that has its number, and a nameless card on a number several people share is not merged into
  one of them. Refused files get a reason that fits: a chat export, damaged JSON, an unclosed
  quote in a CSV, a binary file.
