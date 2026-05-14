#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/rmtv/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_NAME="${DB_NAME:-rmtv}"
DB_USER="${DB_USER:-rmtv}"
DB_HOST="${DB_HOST:-localhost}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="rmtv_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

pg_dump -U "$DB_USER" -h "$DB_HOST" "$DB_NAME" | gzip > "$FILEPATH"

echo "Backup created: $FILEPATH"

find "$BACKUP_DIR" -name "rmtv_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "Cleaned up backups older than ${RETENTION_DAYS} days"
