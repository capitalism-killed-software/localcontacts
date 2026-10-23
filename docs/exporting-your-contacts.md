# Getting your contacts out of each platform

Every service below can hand you a file that localcontacts reads. Export from each one, put the
files in `imports/` (it is gitignored) or anywhere outside the repo, then:

```bash
npm run import -- imports/*        # dry run: shows what it found and what it will merge
npm run import -- --apply imports/*
```

Menus move. Each section links to the vendor's own help page, which wins if it disagrees with
this guide. **Last checked: 22 October 2026**, against those pages. Where a step could not be
confirmed on an official page it says so.

| Platform | You get | Read as |
|---|---|---|
| Google Contacts | `.vcf` or `.csv` | vCard, Google CSV or Outlook CSV |
| Apple (iCloud, Mac, iPhone) | `.vcf` | vCard |
| Outlook, Microsoft 365 | `.csv` | Outlook CSV |
| Proton | `.vcf` | vCard |
| LinkedIn | `Connections.csv` | LinkedIn |
| Telegram | `result.json` | Telegram |
| Android, Samsung | `.vcf` | vCard (often 2.1) |
| Yahoo, Thunderbird, Fastmail, Nextcloud | `.csv` or `.vcf` | CSV or vCard |
| Slack, any CRM, a spreadsheet | `.csv` | generic CSV |
| Signal, WhatsApp | nothing | export your phone's contacts instead |

## Google Contacts

1. Open [contacts.google.com](https://contacts.google.com).
2. Tick the contacts you want. For everything: tick any one contact, then at the top left
   choose **Selection actions → All**.
3. At the top right, **More actions → Export**.
4. Pick a format and **Export**. Any of Google's choices works here; vCard keeps the most.

Work or school accounts cannot export the whole company directory. For a full archive instead,
use [Google Takeout](https://takeout.google.com) with only **Contacts** ticked: you get vCard
files inside a zip (unzip it first), and the archive link expires after about a week.

Help: [Export Google Contacts](https://support.google.com/contacts/answer/7199294),
[Google Takeout](https://support.google.com/accounts/answer/3024190)

## Apple

**iCloud (easiest, gets everything synced from your iPhone and Mac)**

1. Open [icloud.com/contacts](https://www.icloud.com/contacts) and sign in.
2. **Actions** button at the top of the list → **Select All Contacts**.
3. **Share** button → **Export vCard**.

**Contacts on a Mac**

1. Select the contacts (Command-A for all).
2. **File → Export → Export vCard…** and save.

To include notes and photos, check **Contacts → Settings → vCard** first. **File → Export →
Contacts Archive** makes an `.abbu` backup, which is not a vCard and cannot be imported here.

**iPhone and iPad**

Sharing a single contact is built in, but the practical way to get all of them is to turn on
**Settings → [your name] → iCloud → Contacts** and export from iCloud as above. Recent iOS
versions can also export a contact list (Contacts → **Lists**, then the list's export option);
the exact wording depends on your iOS version and could not be confirmed on Apple's page.

Help: [iCloud](https://support.apple.com/guide/icloud/mmfba748b2/icloud),
[Mac](https://support.apple.com/guide/contacts/adrbdcfd32e6/mac),
[iPhone](https://support.apple.com/guide/iphone/iph075ddebf2/ios)

## Microsoft: Outlook, Microsoft 365, Teams

**Outlook.com and Outlook on the web (work, school or personal)**

1. **People** in the left-hand bar.
2. **Manage contacts → Export contacts**.
3. Choose **All contacts** or a folder, then **Export**. A `.csv` lands in your Downloads.

**New Outlook for Windows:** **People → Export contacts** on the ribbon, choose the folder,
**Export**.

**Classic Outlook for Windows:** **File → Open & Export → Import/Export → Export to a file →
Comma Separated Values**, pick the **Contacts** folder, **Browse** to a location, **Finish**. It
says nothing when it is done. Don't open and re-save the file in Excel first; that can damage it.

**Outlook for Mac:** there is no contact export in current versions. Sign in to Outlook on the
web with the same account and export there.

**Teams:** work and school accounts have no contact export; your contacts live in Outlook, so
export those. Teams (free) for personal accounts has an export at
[teams.live.com/dataexport](https://teams.live.com/dataexport) that includes contacts as CSV.

Help: [Outlook on the web](https://support.microsoft.com/en-gb/office/578cca22-3550-4c73-b3f0-9978cfeac83f),
[Classic Outlook](https://support.microsoft.com/en-us/office/10f09abd-643c-4495-bb80-543714eca73f),
[Teams free](https://support.microsoft.com/en-us/teams/free/settings/export-or-delete-your-data-in-microsoft-teams-free)

## Proton

1. Open Proton Contacts (the contacts icon in the right-hand bar of Proton Mail, or
   [account.proton.me](https://account.proton.me)).
2. Tick the select-all box, then **…** → **Export selection as .VCF**.

Proton decrypts the contacts in your browser before saving. vCard only; there is no CSV export.
Proton recommends exporting regularly, because a password reset can make encrypted contact
details unreadable.

Help: [Proton Contacts](https://proton.me/support/proton-contacts)

## LinkedIn

From a computer (not the app):

1. **Me → Settings & Privacy → Data privacy → Download your data**.
2. Choose the larger archive or tick **Connections**, then **Request archive**.
3. LinkedIn emails a download link, from minutes to a couple of days later. The link works for
   72 hours.
4. Inside is `Connections.csv`. Import it as it is; the importer skips LinkedIn's note at the top.

Only first-degree connections are included, with no phone numbers, and an email address only
for people who allow connections to see it. Expect most rows to have just a name, company, title
and profile link; merging with your other exports fills in the rest.

Help: [Download your account data](https://www.linkedin.com/help/linkedin/answer/a1339364),
[Export connections](https://www.linkedin.com/help/linkedin/answer/a566336)

## Telegram

Only the desktop app can export.

1. Install [Telegram Desktop](https://desktop.telegram.org) and sign in.
2. **Settings → Advanced → Export Telegram data**.
3. Tick **Contacts list** (untick everything else to keep it small) and choose
   **Machine-readable JSON**.
4. Import the `result.json` from the export folder.

Telegram contacts have a name and a phone number; the importer merges them with your other
sources by phone.

Help: [Telegram data export](https://telegram.org/blog/export-and-more)

## Android

**Google Contacts app (most phones):** **Fix & manage → Export to file**, choose the account,
**Export to .VCF file**. If your contacts sync to Google, exporting from contacts.google.com
gives the same result.

**Samsung Contacts:** menu → **Manage contacts → Import or export contacts → Export**, choose
where to save, select the contacts, **Export**. Where you can save differs by model; Samsung's
page only lists the SIM and SD card. Avoid the SIM: it keeps only names and numbers.

Help: [Google Contacts on Android](https://support.google.com/contacts/answer/7199294?co=GENIE.Platform%3DAndroid),
[Samsung](https://www.samsung.com/uk/support/mobile-devices/how-do-i-manage-my-contacts/)

## Yahoo, Thunderbird, Fastmail, Nextcloud

**Yahoo Mail:** **Contacts → More options → Export to CSV file**.
[Help](https://help.yahoo.com/kb/SLN36726.html)

**Fastmail:** right-click **All contacts** (or a group) → **Export…**, or
**Settings → Migration → Download all contacts**. You get vCard 3.0.
[Help](https://www.fastmail.help/hc/en-us/articles/1500000280061)

**Thunderbird:** open the Address Book, right-click an address book (not "All Address Books")
and choose **Export…**, then vCard or CSV. Menu names vary between versions and could not be
confirmed on a current official page.

**Nextcloud:** in Contacts, open the settings at the bottom left and use the menu next to the
address book to download it as `.vcf`. The label varies by version.
[Help](https://docs.nextcloud.com/server/latest/user_manual/en/groupware/contacts.html)

## Apps that do not export contacts

**Signal** and **WhatsApp** have no contact export. Both build their list from your phone's
address book, so export that (Apple or Android above) and you have everyone you talk to there.
WhatsApp's **Export chat** gives the messages of one conversation, not contacts.

**Facebook and Messenger:** **Settings & privacy → Settings → Accounts Centre → Your information
and permissions → Export your information** can include your friends list, but it carries names
only, with no email or phone, so it adds little here.

**Slack:** workspace owners and admins can use **Manage members → Export full member list** to
get a CSV of names and emails, which the generic CSV import reads.
[Help](https://slack.com/help/articles/4405848563603)

## CRMs and spreadsheets

HubSpot, Pipedrive, Salesforce and most other tools export contacts to CSV. Save spreadsheets
as CSV first. The importer guesses common column names (Name, Email, Phone, Company, Title,
Notes, URL, and numbered versions such as Email 2). If it guesses wrong, name the columns:

```bash
npm run import -- --map=full_name="Contact Name",email="Work Email",phone=Mobile crm.csv
```

## Getting contacts back out

`npm run export -- --format=vcard --out=contacts.vcf` (or `--format=csv`) writes everything, or
use the same filters as the book (`--source=linkedin`, `--filter=no_email`, `--q=acme`). Each
card also has an **Export vCard** button. Apple, Google, Outlook, Proton and Android all import
the vCard file.
