#!/usr/bin/env bash
# Put localcontacts in your applications menu with its icon.
#   macOS: ~/Applications/localcontacts.app
#   Linux: ~/.local/share/applications/localcontacts.desktop
# Both just run scripts/app/launch.sh. Safe to re-run.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LAUNCH="$DIR/scripts/app/launch.sh"
ICON="$DIR/public/icons/icon-512.png"
chmod +x "$LAUNCH"

case "$(uname)" in
  Darwin)
    APP="$HOME/Applications/localcontacts.app"
    mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
    cat >"$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>localcontacts</string>
  <key>CFBundleDisplayName</key><string>localcontacts</string>
  <key>CFBundleIdentifier</key><string>software.capitalismkilled.localcontacts</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleShortVersionString</key><string>0.1</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>launch</string>
  <key>CFBundleIconFile</key><string>icon.icns</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST
    cat >"$APP/Contents/MacOS/launch" <<SH
#!/bin/bash
exec "$LAUNCH"
SH
    chmod +x "$APP/Contents/MacOS/launch"
    ICONSET="$(mktemp -d)/icon.iconset"
    mkdir -p "$ICONSET"
    for s in 16 32 128 256 512; do
      sips -z "$s" "$s" "$ICON" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
      d=$((s * 2))
      sips -z "$d" "$d" "$ICON" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
    done
    iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/icon.icns"
    touch "$APP"
    echo "Installed $APP"
    echo "Remove it with: rm -r \"$APP\""
    ;;
  Linux)
    DESKTOP="$HOME/.local/share/applications/localcontacts.desktop"
    mkdir -p "$(dirname "$DESKTOP")"
    cat >"$DESKTOP" <<ENTRY
[Desktop Entry]
Type=Application
Name=localcontacts
Comment=Your contacts, in one local book
Exec="$LAUNCH"
Icon=$ICON
Terminal=false
Categories=Office;ContactManagement;
ENTRY
    chmod +x "$DESKTOP"
    command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$(dirname "$DESKTOP")" || true
    echo "Installed $DESKTOP"
    echo "Remove it with: rm \"$DESKTOP\""
    ;;
  *)
    echo "On Windows, run scripts\\app\\launch.cmd and install from the browser (Edge or Chrome: Install app)." >&2
    exit 1
    ;;
esac
