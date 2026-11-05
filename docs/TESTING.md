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
      book. The right page says "Your address book is empty" and offers **Bring in my
      contacts…**, **Look around with sample people** and "Where do I get my contacts?".
- [ ] Closing that window stops the app (on Windows, close the "localcontacts server" window).

If no window appears, open <http://localhost:3000> in your browser instead and note it.

- [ ] Nobody else can open it: on a phone on the same Wi-Fi, try `http://<this computer's
      address>:3000` (macOS: System Settings → Wi-Fi → Details; Windows: `ipconfig`; Linux:
      `hostname -I`). It should not load.

## 3. Try it with the sample people first

Press **Look around with sample people**.

- [ ] 15 made-up people appear, grouped under letters, surnames in bold, and a yellow note above
      the list says they are made up.
- [ ] Clicking a name shows their card on the right page.
- [ ] Up and Down arrow keys move between cards. Home and End jump to the first and last.
- [ ] Click in the names list and type the start of a surname (e.g. "fis"): it jumps to that person.
- [ ] The search box narrows the list as you type, and the open card stays open.
- [ ] Search ignores accents, capitals and phone formatting: "tomas" finds Tomás Ferreira,
      "3035550106" finds Kwame Asante (+1 303 555 0106), and "asante kwame" finds him too.
- [ ] The red ribbon at the top of the left page hides and shows the Groups column.
- [ ] Clicking a group (e.g. "Missing phone") narrows the list; "All Contacts" brings everyone back.

## 4. Clean up (with the sample people still there)

**More → Clean up…** under the groups.

- [ ] **Duplicates** shows the two Sam Riveras side by side, with the fields that differ
      highlighted, and says they may be two people.
- [ ] Choose **Not the same person**, press **Apply**: the pair goes away. **Undo** brings it back.
- [ ] Choose **Keep left**, press **Apply**: one Sam Rivera is left, with both emails, both
      phones, both notes, and the company from the other card.
- [ ] **Names** offers to turn "jo.baker@example.com" into "Jo Baker"; **Apply** does it.
- [ ] **Industries** suggests one for each company (a dental clinic → Healthcare). Untick one,
      press **Apply**: only the ticked ones are filled in, and industry groups appear under the
      groups.

## 5. Bring in your own contacts

1. **More → Guided import…** (or the welcome's **Bring in my contacts…**).
2. Tick the services you use. Each one shows its export steps and a link to the service.
3. Export from one or two of them, and drop each file into its own box.

- [ ] Each file gets a ✓ with its format and a number of contacts, and an **Import** button.
- [ ] A file dropped in the wrong box (for example LinkedIn's file in Google's) gets a warning,
      but can still be imported.
- [ ] After **Import**, the box turns green with a ✓ and the list and groups update.
- [ ] Close the sheet and open it again: the services you ticked are still ticked, and the ones
      you imported are still green.
- [ ] **Import…** under the groups offers "Remove the 15 sample people first", ticked. Leave it
      ticked and import a file: the sample people and their yellow note are gone.
- [ ] A CSV saved by Excel, including a semicolon-separated one from European settings, imports
      with its accents intact.
- [ ] A file that is not a contact export (try any text file) gets a ✗ with an explanation, and
      the Import button does not appear until you remove it.
- [ ] Nothing changes in the list until you press **Import**.
- [ ] Importing the same file again says "Everything in these files is already here."
- [ ] People who appear in two exports (same email or phone) show up once, with both sources
      listed on their card.
- [ ] Right after an import, **Undo this import** puts the book back as it was.

## 6. Backups

**More → Backups…**

- [ ] Every import, clean-up and restore you made is listed, newest first, saying what it was
      taken before ("Before importing contacts.vcf", "Before merging duplicates"), with its date,
      number of cards and size.
- [ ] **Restore** on an older one asks first, then puts the book back as it was then. A new
      backup "Before restoring the backup from …" appears at the top, and restoring that one
      undoes the restore.
- [ ] **Delete** asks first, then removes the backup.

## 7. Edit a card

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

## 8. Export

- [ ] **Export vCard** on a card downloads a `.vcf` file. Opening it with your computer's own
      Contacts app (or importing it into Google Contacts) shows the same person.
- [ ] **More → Export…** in a group (e.g. LinkedIn) says how many cards it will export, and
      **Spreadsheet (.csv)** downloads a file named after the group and the date. It opens in a
      spreadsheet with one column per email and phone, and phone numbers starting with + show
      as text (with an apostrophe in front), not as a number or a formula error.
- [ ] **vCard (.vcf)** downloads the same cards, photos included.
- [ ] Importing the exported CSV back says "Everything in these files is already here."

## 9. About and updates

- [ ] **More → About localcontacts** shows the version and where the database file is.
- [ ] **Check for updates** says you have the latest version (or names a newer one with a link).
      Nothing is sent anywhere until you press it.

## 10. Bigger lists

If you have more than a few hundred contacts:

- [ ] Scrolling the names list is smooth, and the current letter stays pinned at the top.
- [ ] Clicking between cards feels instant.

## 11. On a phone (optional)

Only if the app runs on a computer your phone can reach (see the
[deployment guide](DEPLOY.md), section 3).

- [ ] The book shows one page at a time; a groups menu replaces the column; "‹ All Contacts"
      goes back.
- [ ] Your phone's browser offers to add it to the home screen.

## 12. App icon on your computer

- [ ] macOS or Linux: `bash scripts/app/install-desktop.sh` puts **localcontacts** in your
      Applications (macOS) or app launcher (Linux) with a leather-book icon, and opening it
      starts the app. **On a Mac this has never been tried: please report exactly what happens.**
- [ ] Any OS: in Chrome or Edge, the install icon in the address bar adds it as an app.

## 13. Docker (optional, for home servers)

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
