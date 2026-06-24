#!/usr/bin/env bash
# Build + email the daily paper to the Kindle. Run by the kitt-digest systemd timer.
set -uo pipefail
RESULT=$(curl -fsS -X POST "http://127.0.0.1:${PORT:-8787}/digest/send" --max-time 1500)
echo "$RESULT"
logger -t kitt-digest "${RESULT:-build failed}"
