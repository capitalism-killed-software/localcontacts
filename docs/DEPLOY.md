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

`npm run dev` works too and reloads on code changes, but `npm start` is faster. Stop it
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

**Tailscale or another VPN.** Install Tailscale on the server and on your phone, then
make the app listen on the server's Tailscale address instead of localhost. With Docker,
change the port line in `docker-compose.yml` to `"100.x.y.z:3000:3000"` (your Tailscale
IP) and restart. Without Docker: `HOSTNAME=100.x.y.z npm start`. Only devices in your
tailnet can connect.

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

The database uses SQLite's write-ahead log, so a plain file copy while the app is running
can miss the most recent writes. Either stop the app and copy the file, or ask SQLite for
a consistent copy while it runs:

```bash
sqlite3 data/contacts.db ".backup backups/contacts-$(date +%F).db"
```

With Docker, run the same inside the container
(`docker compose exec localcontacts sqlite3 …`) or stop it first. Restoring is copying the
file back.

## 6. Settings

All optional, all environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | port to listen on |
| `HOSTNAME` | `localhost` | address to bind to |
| `CONTACTS_DB_PATH` | `data/contacts.db` | where the database lives |
| `CONTACTS_DEFAULT_COUNTRY` | `US` | country assumed for phone numbers without a `+` prefix |
| `NEXT_TELEMETRY_DISABLED` | unset (`1` in Docker) | stop Next.js's anonymous telemetry |
