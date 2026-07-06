#!/bin/sh
# Nightly pg_dump with rotation (OPERATIONS.md §4). Live from day one. Keeps 7
# daily + 4 weekly custom-format dumps in /backups. Off-VPS replication (rclone to
# an owner-supplied B2/S3 bucket) is the last step — wire RCLONE_REMOTE to enable
# it; a backup that never leaves the box isn't a backup.
set -eu

BACKUP_DIR=/backups
RETAIN_DAILY=7
RETAIN_WEEKLY=4

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

dump_once() {
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  dow=$(date -u +%u) # 1=Mon..7=Sun
  out="$BACKUP_DIR/daily/towventure-$ts.dump"
  echo "[backup] $ts → $out"
  pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$out"

  # Weekly snapshot on Sundays.
  if [ "$dow" = "7" ]; then
    cp "$out" "$BACKUP_DIR/weekly/towventure-$ts.dump"
  fi

  # Rotate.
  ls -1t "$BACKUP_DIR/daily/"*.dump 2>/dev/null | tail -n +$((RETAIN_DAILY + 1)) | xargs -r rm -f
  ls -1t "$BACKUP_DIR/weekly/"*.dump 2>/dev/null | tail -n +$((RETAIN_WEEKLY + 1)) | xargs -r rm -f

  # Off-box replication (optional until a bucket is supplied).
  if [ -n "${RCLONE_REMOTE:-}" ]; then
    rclone copy "$BACKUP_DIR/daily/towventure-$ts.dump" "$RCLONE_REMOTE" || echo "[backup] rclone failed"
  fi
}

# Run once immediately, then every 24h. (A host cron can call this script instead
# for finer scheduling; the loop keeps the compose service self-contained.)
while true; do
  dump_once || echo "[backup] dump failed"
  sleep 86400
done
