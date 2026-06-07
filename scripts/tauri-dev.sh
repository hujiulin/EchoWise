#!/usr/bin/env bash
#
# Wraps `tauri dev` and ad-hoc signs the debug binary with the microphone
# entitlement every time cargo relinks it. Without this, the macOS WebView
# refuses navigator.mediaDevices.getUserMedia.
#
# Strategy: launch `tauri dev` in background, then watch the binary's mtime
# and re-sign whenever it changes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/src-tauri/target/debug/echowise"
ENTITLEMENTS="$ROOT/src-tauri/entitlements.plist"

if [[ "$(uname -s)" != "Darwin" ]]; then
  exec npx tauri dev "$@"
fi

sign() {
  if [[ -x "$BIN" ]]; then
    codesign --force --sign - --entitlements "$ENTITLEMENTS" "$BIN" >/dev/null 2>&1 || true
  fi
}

# Background watcher: re-sign whenever the binary mtime changes.
last_mtime=""
(
  while true; do
    if [[ -f "$BIN" ]]; then
      cur_mtime="$(stat -f %m "$BIN" 2>/dev/null || echo "")"
      if [[ -n "$cur_mtime" && "$cur_mtime" != "$last_mtime" ]]; then
        last_mtime="$cur_mtime"
        sign
        echo "[tauri-dev] re-signed $(basename "$BIN") with mic entitlement"
      fi
    fi
    sleep 1
  done
) &
WATCHER_PID=$!

cleanup() {
  kill "$WATCHER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

exec npx tauri dev "$@"
