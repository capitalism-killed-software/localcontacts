# What this is, and why

## The problem

Your contacts are not in one place. Some are in the phone, some in a Google account or
two, some in a work Outlook, some only exist as LinkedIn connections, some as Telegram
or Signal threads. Each service holds its slice and offers to hold the rest, as long as
you upload everything to it. The usual answer, a CRM, is the same deal with a monthly fee:
every name, number and note you have collected about other people goes to someone else's
servers.

## What this is

A small application you run on your own computer. It reads the export files those
services already give you, recognises each one, merges the same person across them, and
keeps everything in a single SQLite file on your disk. You get a list you can search,
sort, filter and edit, and that is all.

It is deliberately plain: a web page served by a local process, a file in a folder, a
command-line importer. Anyone who can run `npm install` can run it; anyone who can copy a
file can back it up.

## Why it was built this way

Contacts are personal data twice over. They are yours, and they are also every other
person's name, employer, phone number and email, which those people gave you and not to a
third party. The design rules follow from that:

- **Nothing leaves your machine.** The app makes no network calls of its own; a contact
  photo that is only a web link in a vCard is skipped rather than fetched. There is no
  sign-up, no sync, no telemetry, no analytics, and no automatic update check. The one
  exception is a button you press: **Check for updates** on the About sheet asks GitHub for
  the number of the latest release. GitHub sees your IP address, as any website would, and
  nothing about your contacts. In a production build the page's content policy lets the
  browser connect only to the app and to GitHub's API, so nothing else can be contacted
  even by mistake. Next.js's own anonymous telemetry is switched off in the Docker image, and
  you can switch it off for a local install with `npx next telemetry disable`.
- **No AI touches your contacts.** No model reads, enriches, classifies or summarises the
  people in your list. The one classifier that exists (industry, from company and title)
  is a table of keywords you can read and edit. Inventing facts about real people is a
  harm, not a feature.
- **The file is the product.** Your data is one SQLite file in `data/`. Open it with any
  SQLite tool, copy it anywhere, delete it and the app forgets everything.
- **Imports are lossless and reversible.** Every email, phone and link in an export is
  kept, nothing already stored is overwritten, and the importer is a dry run until you
  say `--apply`. The export files themselves are never modified.
- **Your exports never end up in git.** `data/`, `imports/` and any contact file at the
  repo root are ignored, so a careless `git add .` cannot publish your address book.
- **Single user, no accounts.** There is no login because there is no server for anyone
  else to log in to. This also means you must not expose it to the open internet; the
  [deployment guide](DEPLOY.md) shows how to reach it from your phone without doing that.

## What it is not

Not a CRM, not a team tool, not a sync service, not a cloud. It does not talk to the
services it imports from, so it will not keep itself up to date; you export again when you
want fresh data, and the importer merges the new file into what you have.

## Who made it

Capitalism Killed Software, released under the MIT licence. Contributions are welcome;
see the [roadmap](ROADMAP.md) for what is next.
