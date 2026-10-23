# Changelog

## 1.0.0 (unreleased)

The first public release.

**Importing**
- Reads vCard 2.1, 3.0 and 4.0 (Apple, Google, Proton, Android, Outlook, Thunderbird), Google
  Contacts CSV in both layouts, Outlook CSV, LinkedIn `Connections.csv`, Telegram `result.json`
  and any CSV with a header row; formats are recognised from the contents.
- Merges the same person across files by email, then phone (normalised, so formatting doesn't
  matter, and never when the emails disagree), then name. Keeps every email, phone and link and
  an embedded photo; never overwrites what is stored.
- An import page in the app with a dry-run summary, column choices for CSVs it can't read on its
  own, and a backup of the database before writing. The same import from the command line
  (`npm run import`).

**The book**
- The look of Address Book from OS X 10.7/10.8: groups (sources, industries, smart groups),
  names sorted by surname with A–Z sections, the card with its photo, edit mode with add and
  remove rows, Lion's ribbon to hide the groups. One page at a time on a phone.
- Arrow keys, Home, End and the page keys move between cards.
- Fast with large address books: the names list loads once and draws only what is on screen.

**Exporting**
- vCard 3.0 and CSV from the command line (`npm run export`) with the book's filters, and an
  Export vCard button on each card. Exports import back unchanged.

**Running it**
- Any OS with Node 22.13 or newer; Docker; an installable web app with its own icon; launchers
  for a window of its own on macOS, Linux and Windows.
- Answers only known host names and accepts writes only from its own pages; no network calls,
  no telemetry, no AI.
