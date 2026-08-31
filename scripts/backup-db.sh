#!/usr/bin/env bash
#
# Nightly database backup. Install on the VPS:
#
#   sudo cp backup-db.sh /usr/local/bin/notex-backup
#   sudo chmod +x /usr/local/bin/notex-backup
#   sudo mkdir -p /var/backups/notex
#   crontab -e   ->   17 4 * * * /usr/local/bin/notex-backup >> /var/log/notex-backup.log 2>&1
#
# Keeps 30 days locally. If the AWS CLI is installed and S3_* are exported in
# /etc/notex-backup.env, it also pushes a copy to object storage, so a lost
# server does not mean a lost semester.

set -euo pipefail

DB_NAME="${DB_NAME:-notex}"
DEST="${DEST:-/var/backups/notex}"
KEEP_DAYS="${KEEP_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="${DEST}/notex-${STAMP}.sql.gz"

[ -f /etc/notex-backup.env ] && . /etc/notex-backup.env

mkdir -p "$DEST"

# --clean --if-exists so the dump can be restored over an existing database.
sudo -u postgres pg_dump --clean --if-exists --no-owner "$DB_NAME" | gzip -9 > "$FILE"

SIZE="$(du -h "$FILE" | cut -f1)"
echo "$(date -u +%FT%TZ) wrote ${FILE} (${SIZE})"

# A backup nobody checked is not a backup: fail loudly on an empty dump.
if [ "$(stat -c %s "$FILE")" -lt 10000 ]; then
  echo "$(date -u +%FT%TZ) ERROR: dump is suspiciously small, keeping it but check the database" >&2
  exit 1
fi

if command -v aws >/dev/null && [ -n "${S3_BUCKET:-}" ] && [ -n "${S3_ENDPOINT:-}" ]; then
  aws --endpoint-url "$S3_ENDPOINT" s3 cp "$FILE" "s3://${S3_BUCKET}/backups/$(basename "$FILE")" \
    && echo "$(date -u +%FT%TZ) copied to s3://${S3_BUCKET}/backups/"
fi

find "$DEST" -name 'notex-*.sql.gz' -mtime "+${KEEP_DAYS}" -delete
echo "$(date -u +%FT%TZ) pruned backups older than ${KEEP_DAYS} days"
