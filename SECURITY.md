# Security

localcontacts is a **single-user app with no login**, built to run on your own computer or a
home server you control. Its safety comes from not being reachable by anyone else.

## How it protects your contacts

- **It answers only known host names.** Requests addressed to anything other than `localhost`,
  `127.0.0.1`, `::1` or the names in `CONTACTS_ALLOWED_HOSTS` are refused, which stops
  DNS-rebinding attacks from websites you visit.
- **Writes come only from its own pages.** Saving, deleting and importing check that the request
  came from the app itself, so another site open in your browser cannot change your data.
- **No network calls.** It never fetches anything: not updates, not analytics, not photos
  linked from a vCard.
- **Untrusted files are treated as data.** Imported text is escaped when shown, links become
  clickable only if they are web, mail or phone links, and photos are accepted only when their
  bytes are a JPEG, PNG, GIF or WebP image of at most 2 MB. Photos are served with
  `nosniff` and a restrictive content policy.
- **Backups before imports.** Every import first saves a copy of the database to
  `data/backups/`.

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

## Reporting a vulnerability

Please report security problems privately: use GitHub's "Report a vulnerability" on the
repository's Security tab rather than a public issue, with steps to reproduce using made-up
contacts. We aim to reply within a week.
