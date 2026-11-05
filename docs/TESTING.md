# Testing localcontacts

A checklist for trying localcontacts on a real computer before it is released. You do not need
to be a developer. Work through the sections in order, tick each box, and write down anything
that does not match **Expected**.

Use your own contacts if you like: they stay on your computer. But **never paste real names,
emails, phone numbers or screenshots of real contacts into a bug report.** Describe the problem
with made-up details instead (see "Reporting a problem" at the end).

Tell us which computer you used:

- [ ] macOS (version: ____ )  - [ ] Windows (version: ____ )  - [ ] Linux (which: ____ )
- Browser: ____________

## 1. Install

1. Install **Node.js 24** from [nodejs.org](https://nodejs.org) (the "LTS" button). Accept the
   defaults.
2. Get the code. Either download it as a zip from GitHub (green **Code** button → **Download
   ZIP**) and unzip it, or, if you have git: `git clone https://github.com/capitalism-killed-software/localcontacts.git`.
3. Open a terminal in that folder (macOS: Terminal; Windows: right-click the folder → **Open in
   Terminal**; Linux: your terminal).
4. Run `npm install`.

- [ ] `npm install` finished without red `ERR!` lines. (Yellow warnings are fine.)

## 2. Start it

macOS and Linux: `npm run app`. Windows: `scripts\app\launch.cmd`.

- [ ] The first start takes a minute (it builds), then a window opens showing a brown leather
      book with "No cards" on the left page.
- [ ] Closing that window stops the app (on Windows, close the "localcontacts server" window).

If no window appears, open <http://localhost:3000> in your browser instead and note it.

- [ ] Nobody else can open it: on a phone on the same Wi-Fi, try `http://<this computer's
      address>:3000` (macOS: System Settings → Wi-Fi → Details; Windows: `ipconfig`; Linux:
      `hostname -I`). It should not load.

## 3. Try it with fake contacts first

In the terminal (stop the app first with Ctrl-C, or use a second terminal):
`npm run import -- --apply seed/sample-contacts.csv`, then start the app again.

- [ ] 15 people appear (the sample has one deliberate duplicate, which is merged), grouped
      under letters, surnames in bold.
- [ ] Clicking a name shows their card on the right page.
- [ ] Up and Down arrow keys move between cards. Home and End jump to the first and last.
- [ ] Click in the names list and type the start of a surname (e.g. "lov"): it jumps to that person.
- [ ] The search box narrows the list as you type, and the open card stays open.
- [ ] Search ignores accents, capitals and phone formatting: "nunez" finds José Núñez-Ibáñez,
      "2025550102" finds Grace Hopper (+1-202-555-0102), and "hopper grace" finds her too.
- [ ] The red ribbon at the top of the left page hides and shows the Groups column.
- [ ] Clicking a group (e.g. "Missing phone") narrows the list; "All Contacts" brings everyone back.

## 4. Import your own exports

Export your contacts from one or two places you use, following
[Exporting your contacts](exporting-your-contacts.md) (Google, iCloud, Outlook, LinkedIn…).

1. In the app press **Import…** at the bottom of the Groups column.
2. Drop the files onto the dashed box, or click it and choose them.

- [ ] Each file gets a ✓ with its format and a number of contacts.
- [ ] A CSV saved by Excel, including a semicolon-separated one from European settings, imports
      with its accents intact.
- [ ] A file that is not a contact export (try any text file) gets a ✗ with an explanation, and
      the Import button does not appear until you remove it.
- [ ] The summary shows how many are new and how many merge with people already there.
- [ ] Nothing changes in the list until you press **Import**.
- [ ] After **Import**, the list and groups update and it says a backup was saved.
- [ ] Importing the same file again says "Everything in these files is already here."
- [ ] People who appear in two exports (same email or phone) show up once, with both sources
      listed on their card.

## 5. Edit a card

- [ ] **Edit** opens the card for editing; change the name and press **Done**: the list
      re-sorts with the new name.
- [ ] The green ⊕ adds another email or phone row; the red ⊖ removes one.
- [ ] Click the photo square, choose a photo (JPEG or PNG under 2 MB): it shows on the card.
- [ ] Choosing something that is not an image, or an image file that is damaged or only partly
      downloaded, shows a red message instead.
- [ ] **remove** under the photo clears it.
- [ ] **+** under the names list creates a new card. Double-clicking **Done** still makes only
      one card.
- [ ] With changes typed but not saved, clicking another name or group asks before throwing them
      away; **Cancel** just cancels.
- [ ] **Delete Card…** asks first, then removes the card.

## 6. Export

- [ ] **Export vCard** on a card downloads a `.vcf` file. Opening it with your computer's own
      Contacts app (or importing it into Google Contacts) shows the same person.
- [ ] In the terminal, `npm run export -- --format=csv --out=everyone.csv` writes a CSV that
      opens in a spreadsheet with one column per email and phone.

## 7. Bigger lists

If you have more than a few hundred contacts:

- [ ] Scrolling the names list is smooth, and the current letter stays pinned at the top.
- [ ] Clicking between cards feels instant.

## 8. On a phone (optional)

Only if the app runs on a computer your phone can reach (see the
[deployment guide](DEPLOY.md), section 3).

- [ ] The book shows one page at a time; a groups menu replaces the column; "‹ All Contacts"
      goes back.
- [ ] Your phone's browser offers to add it to the home screen.

## 9. App icon on your computer

- [ ] macOS or Linux: `bash scripts/app/install-desktop.sh` puts **localcontacts** in your
      Applications (macOS) or app launcher (Linux) with a leather-book icon, and opening it
      starts the app. **On a Mac this has never been tried: please report exactly what happens.**
- [ ] Any OS: in Chrome or Edge, the install icon in the address bar adds it as an app.

## 10. Docker (optional, for home servers)

`docker compose up -d --build`, then <http://localhost:3000>.

- [ ] The book opens; data survives `docker compose restart`.

## Reporting a problem

For each problem, write:

1. **What you did**, step by step.
2. **What you expected** and **what happened instead**.
3. Your computer and browser (from the top of this page).
4. Any red text from the terminal, copied as text.

Replace any real person's details with made-up ones before sending. If an import misbehaves, say
which service the file came from and roughly how many contacts it had; don't send the file.

## For developers

`npm test` runs the unit tests; `npm run test:e2e` builds the app and runs the browser tests
(Chromium) against fake data; `npx playwright test --grep @visual` compares screenshots of the
main views with the baselines in `tests/e2e/0-visual.spec.ts-snapshots/`.
