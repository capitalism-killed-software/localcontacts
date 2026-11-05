# Security

localcontacts is a **single-user app with no login**, built to run on your own computer or a
home server you control. Its safety comes from not being reachable by anyone else.

## How it protects your contacts

- **It listens on your computer only.** `npm start`, `npm run app` and the launchers accept
  connections from this machine alone (127.0.0.1); the Docker setup publishes the port on
  127.0.0.1 too. Reaching it from another device is something you turn on, as described in
  [docs/DEPLOY.md](docs/DEPLOY.md).
- **It answers only known host names.** Requests addressed to anything other than `localhost`,
  `127.0.0.1`, `::1`, a name ending in `.localhost` (browsers send those to this machine) or the
  names in `CONTACTS_ALLOWED_HOSTS` are refused, which stops DNS-rebinding attacks from websites
  you visit. Only the app's own scripts and styles, which hold no contacts, are served to any
  name.
- **Writes come only from its own pages.** Every save, delete and import is checked before it
  runs: the browser's `Origin` must be the app itself, so another site open in your browser
  cannot change your data. No other site may show the app in a frame, so its buttons can't be
  clicked through a disguised page.
- **No network calls.** It never fetches anything: not updates, not analytics, not photos
  linked from a vCard.
- **Untrusted files are treated as data.** Imported text is escaped when shown, links become
  clickable only if they are web, mail or phone links, and photos are accepted only when their
  bytes are a JPEG, PNG, GIF or WebP image of at most 2 MB. Photos are served with
  `nosniff` and a restrictive content policy.
- **Backups before changes in bulk.** Every import that adds or changes a card, removing the
  sample people, a restore, and the clean-up scripts (`clean:names`, `merge:dupes`,
  `classify:industry`) first save a copy of the database to `data/backups/` next to it. The
  Backups sheet restores or deletes only files in that folder whose names it made itself
  (`contacts-<date>-<time>.db`), and checks a backup reads as a contacts database before using it.

## What you need to do

- Don't expose it to the internet. Reach it from other devices through a VPN, an SSH tunnel or
  an authenticating proxy, as described in [docs/DEPLOY.md](docs/DEPLOY.md).
- Treat `data/` like the address book it is: back it up, and keep it out of git (it is ignored
  by default).

## Known limits

- Anyone who can open the app can read and change everything in it. That is by design for a
  one-person tool; put it behind a password (DEPLOY.md, section 3) if others share the machine
  or network.
- CSV exports are written as they are. A contact whose name starts with `=` could be read as a
  formula by a spreadsheet; only open exports of data you trust in Excel.
- An import is read into memory whole while it is checked: a file near the 100 MB limit can
  briefly take a few GB of memory. Only the app's own import page can send one.

## Reporting a vulnerability

Please report security problems privately: use GitHub's "Report a vulnerability" on the
repository's Security tab rather than a public issue, with steps to reproduce using made-up
contacts. We aim to reply within a week.
