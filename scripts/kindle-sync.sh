#!/usr/bin/env bash
# Poll zordon for the Kindle; if present, pull vocab.db and import it into the
# kitt vocab service. No-op (exit 0) when the Kindle isn't connected. Idempotent:
# only POSTs /import when vocab.db actually changed.
set -uo pipefail

DEST="$HOME/kindle-sync/vocab.db"
HASHFILE="$HOME/kindle-sync/.last-hash"
PORT="${PORT:-8787}"
mkdir -p "$HOME/kindle-sync"

# Single-instance lock — the timer and a manual run must never overlap
# (they'd race the shared host mount and /tmp/vocab.db).
exec 9>"$HOME/kindle-sync/.lock"
flock -n 9 || exit 0

# 1. On the host (where the Kindle reliably appears): grab vocab.db if the device is awake.
ssh -o BatchMode=yes -o ConnectTimeout=8 zordon bash -s <<'REMOTE' || exit 0
set -uo pipefail
rm -f /tmp/vocab.db
lsusb | grep -qi kindle || exit 3          # not connected -> nothing to do
mkdir -p /mnt/kindle; fusermount -u /mnt/kindle 2>/dev/null || true
jmtpfs /mnt/kindle 2>/dev/null; sleep 1
v=$(find /mnt/kindle -maxdepth 6 -iname vocab.db 2>/dev/null | head -1)
[ -n "$v" ] && cp "$v" /tmp/vocab.db
fusermount -u /mnt/kindle 2>/dev/null || true
[ -f /tmp/vocab.db ]                        # success only if we actually grabbed it
REMOTE

# 2. Pull it to kitt.
scp -q zordon:/tmp/vocab.db "$DEST" || exit 1

# 3. Import only if the file changed since last time.
NEW=$(sha256sum "$DEST" | cut -d' ' -f1)
OLD=$(cat "$HASHFILE" 2>/dev/null || echo none)
if [ "$NEW" != "$OLD" ]; then
  if curl -fsS -X POST "http://127.0.0.1:${PORT}/vocab/import" -H 'content-type: application/json' -d '{}' >/dev/null; then
    echo "$NEW" > "$HASHFILE"
    logger -t kindle-sync "imported updated vocab.db"
  fi
fi
