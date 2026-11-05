# Deployment guide

localcontacts is a single-user app with no login. Run it where only you can reach it:
on your own computer, or on a home server reached through a VPN or an SSH tunnel. Never
put it on the open internet without an authenticating proxy in front of it.

Everything it stores is one file, `data/contacts.db`. Back that file up and you have
backed up the app.

## 1. On your own computer (recommended)

Requires Node.js 22.13 or newer.

```bash
git clone https://github.com/capitalism-killed-software/localcontacts.git
cd localcontacts
npm install
npm run build
npm start          # http://localhost:3000
```

`npm start` listens on this computer only (127.0.0.1), so other devices on your network
cannot open it; section 3 explains how to reach it from them on purpose. `npm run dev` works too and reloads on code changes, but `npm start` is faster. Stop it
with Ctrl-C. The database and `imports/` folder live inside the project directory.

To stop Next.js sending its anonymous usage telemetry, once:

```bash
npx next telemetry disable
```

## 2. With Docker (home server, NAS, any Linux box)

The repo ships a `Dockerfile` and a `docker-compose.yml`. The container binds to
`127.0.0.1:3000` on the host, so nothing outside the machine can reach it until you
decide how (section 3).

```bash
git clone https://github.com/capitalism-killed-software/localcontacts.git
cd localcontacts
docker compose up -d --build
```

Your database is the `./data` folder next to the compose file, and `./imports` is mounted
into the container for exports you want to import:

```bash
cp ~/Downloads/contacts.vcf imports/
docker compose exec localcontacts npm run import -- imports/contacts.vcf           # dry run
docker compose exec localcontacts npm run import -- --apply imports/contacts.vcf   # write
```

Update to a newer version:

```bash
git pull
docker compose up -d --build
```

The schema migrates itself on start, so an older database just works.

## 3. Reaching it from your phone or another computer, safely

Pick one. All of them keep the app off the public internet.

**First, tell it the name you'll use.** The app only answers requests addressed to
`localhost`, `127.0.0.1` or `::1`; anything else gets "does not answer requests for …". This
stops a website you visit from reaching your contacts by pointing its own domain at your
machine (DNS rebinding). If you reach it by another name or address, list it:

```bash
CONTACTS_ALLOWED_HOSTS=100.64.1.2,contacts.example.com npm start
```

With Docker, add `- CONTACTS_ALLOWED_HOSTS=…` under `environment:` in `docker-compose.yml`.
The SSH tunnel below needs nothing, because you still open `localhost`.

**Tailscale or another VPN.** Install Tailscale on the server and on your phone, then
make the app listen on the server's Tailscale address instead of localhost. With Docker,
change the port line in `docker-compose.yml` to `"100.x.y.z:3000:3000"` (your Tailscale
IP), add `CONTACTS_ALLOWED_HOSTS=100.x.y.z` and restart. Without Docker:
`CONTACTS_LISTEN=100.x.y.z CONTACTS_ALLOWED_HOSTS=100.x.y.z npm start`. It then listens on
the Tailscale address only, so only devices in your tailnet can connect.

**SSH tunnel.** From the computer you are sitting at:

```bash
ssh -L 3000:127.0.0.1:3000 you@your-server
```

then open http://localhost:3000 locally. Nothing to configure on the server.

**Reverse proxy with a password.** If you want a hostname, put Caddy in front and require
a password. Caddy also handles HTTPS for you. In your `Caddyfile`:

```
contacts.example.com {
    basic_auth {
        you JDJhJDE0JE...   # output of: caddy hash-password
    }
    reverse_proxy 127.0.0.1:3000
}
```

and start the app with `CONTACTS_ALLOWED_HOSTS=contacts.example.com`.

Basic auth over HTTPS is adequate for one person. It is not a substitute for the VPN
options if the server holds other sensitive things.

## 4. What not to do

- Do not run it on a platform without a persistent disk (serverless hosts, most free
  tiers). The app is built around a local SQLite file; an ephemeral filesystem loses your
  data on every deploy.
- Do not publish port 3000 to the internet, and do not change the compose file's
  `127.0.0.1` binding to `0.0.0.0` unless a firewall or proxy is already in place.
- Do not commit `data/` or `imports/`. They are gitignored; keep them that way.

## 5. Backups

Every import that adds or changes a card (from the import page or `npm run import -- --apply`),
and every clean-up script run with `--apply`, first saves a consistent copy of the database to
`data/backups/contacts-<date>-<time>.db`, in local time; a second backup in the same second gets
a letter (`…-180800b.db`) so the names sort in order. Delete old ones whenever you like.

Inside Docker the clock is UTC unless you give the container your time zone: uncomment the `TZ`
line under `environment:` in `docker-compose.yml` (for example `- TZ=Europe/London`).

For your own backups: the database uses SQLite's write-ahead log, so a plain file copy while the app is running
can miss the most recent writes. Either stop the app and copy the file, or ask SQLite for
a consistent copy while it runs:

```bash
sqlite3 data/contacts.db ".backup backups/contacts-$(date +%F).db"
```

With Docker, run the same inside the container
(`docker compose exec localcontacts sqlite3 …`) or stop it first. Restoring is copying the
file back.

## 6. Install it as an app

localcontacts is a web page, so any browser can install it with an icon of its own once the
server is running. Two launchers make the server part painless.

**A window of its own (macOS, Linux).** `npm run app`, or `bash scripts/app/launch.sh`,
builds the app the first time, starts the server (port 3000, or `PORT`), opens it in a
chromeless window in the first of Chrome, Chromium, Edge, Brave or Vivaldi it finds, and stops
the server when you close that window. With none of those installed it opens your default
browser and keeps the server running until Ctrl-C.

**An icon in your applications.** `bash scripts/app/install-desktop.sh` writes
`~/Applications/localcontacts.app` on a Mac (with the icon, built with `sips` and `iconutil`)
or `~/.local/share/applications/localcontacts.desktop` on Linux. Both run the launcher above.
Re-run it after moving the repo; it prints how to remove what it made. The macOS bundle was
written from Apple's documentation and has not yet been run on a Mac by the author; if it
misbehaves, open an issue with the message.

**Windows.** `scripts\app\launch.cmd` starts the server and opens the window with Edge or
Chrome. For a Start Menu icon use the browser's own install, below.

**Install from the browser.** With the page open:

| Browser | Where |
|---|---|
| Chrome, Edge, Brave on any desktop | the install icon at the right of the address bar, or the browser menu → Install |
| Safari on macOS 14 or newer | File → Add to Dock |
| Chrome on Android | menu → Install app, or the prompt it shows |
| Safari on iPhone and iPad | Share → Add to Home Screen |

The install uses the web app manifest and icons the server provides. On a phone the server
must be reachable over HTTPS for a real standalone install (Tailscale Serve or the Caddy setup
in section 3); over plain `http://` the phone adds a bookmark-style shortcut instead.

Why there is no APK or App Store app: the app is a Node server with a SQLite file on disk.
Phones cannot run that, so an installed web app on a phone is a window onto the server on your
computer or home server, which is exactly what section 3 sets up.

## 7. Settings

All optional, all environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | port to listen on |
| `CONTACTS_LISTEN` | `127.0.0.1` (`0.0.0.0` inside the Docker image) | address `npm start` listens on; `npm run app` and the launchers always use `127.0.0.1` |
| `CONTACTS_DB_PATH` | `data/contacts.db` | where the database lives |
| `CONTACTS_DEFAULT_COUNTRY` | `US` | country assumed for phone numbers without a `+` prefix |
| `CONTACTS_ALLOWED_HOSTS` | unset | extra host names or addresses the app answers, comma-separated (see section 3); `*` turns the check off |
| `NEXT_TELEMETRY_DISABLED` | unset (`1` in Docker) | stop Next.js's anonymous telemetry |
