#!/bin/sh
set -eu

start_cron() {
  if ! command -v cron >/dev/null 2>&1; then
    echo "[cron] cron command not found; skipping daemon startup"
    return
  fi

  rm -f /var/run/crond.pid /run/crond.pid /var/run/cron.pid /run/cron.pid 2>/dev/null || true
  cron
  echo "[cron] daemon started"
}

mode="${1:-prod}"

start_cron

if [ "$mode" = "dev" ]; then
  bun scripts/register-cron.ts || echo "[cron] registration failed in dev startup"
  bun run dev:inspect &
  pid=$!
  bun run debug:arm || true
  wait "$pid"
  exit $?
fi

exec bun run start
