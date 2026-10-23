#!/usr/bin/env bash
# Start localcontacts and open it in its own window (macOS and Linux).
#
# Builds on first run, starts the server on PORT (default 3000) unless one is
# already answering there, opens a chromeless window in the first Chromium-based
# browser found, and stops the server it started when that window closes. With
# no such browser it opens the default browser and leaves the server running
# until Ctrl-C.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-3000}"
URL="http://localhost:$PORT"
LOG="${TMPDIR:-/tmp}/localcontacts.log"
PROFILE="$HOME/.localcontacts/browser-profile"

cd "$DIR"
command -v node >/dev/null 2>&1 || { echo "Node.js 22.13 or newer is required: https://nodejs.org" >&2; exit 1; }
[ -d node_modules ] || npm install --no-audit --no-fund
[ -f .next/BUILD_ID ] || npm run build

up() { curl -fsS -o /dev/null "$URL" 2>/dev/null; }

server=""
if ! up; then
  NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next start -p "$PORT" >"$LOG" 2>&1 &
  server=$!
  for _ in $(seq 1 120); do up && break; sleep 0.5; done
  up || { echo "The server did not start; see $LOG" >&2; kill "$server" 2>/dev/null || true; exit 1; }
fi
stop_server() { [ -n "$server" ] && kill "$server" 2>/dev/null || true; }
trap stop_server EXIT

browser=""
if [ "$(uname)" = Darwin ]; then
  for app in "Google Chrome" Chromium "Microsoft Edge" "Brave Browser" Vivaldi; do
    candidate="/Applications/$app.app/Contents/MacOS/$app"
    [ -x "$candidate" ] && { browser="$candidate"; break; }
  done
else
  for cmd in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge brave-browser vivaldi; do
    command -v "$cmd" >/dev/null 2>&1 && { browser="$(command -v "$cmd")"; break; }
  done
fi

mkdir -p "$PROFILE"
if [ -n "$browser" ]; then
  echo "localcontacts is at $URL (window: $(basename "$browser"))"
  # Returns when the window is closed, because the dedicated profile has no other windows.
  "$browser" --app="$URL" --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check >/dev/null 2>&1 || true
else
  echo "localcontacts is at $URL. No Chromium-based browser found for an app window; opening the default browser."
  if [ "$(uname)" = Darwin ]; then open "$URL"; else xdg-open "$URL" >/dev/null 2>&1 || true; fi
  if [ -n "$server" ]; then
    echo "Press Ctrl-C to stop the server."
    wait "$server"
  fi
fi
