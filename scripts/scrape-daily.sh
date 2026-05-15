#!/usr/bin/env bash
set -euo pipefail

# Daily CDN data fetch and import for RM.tv
# Safe to run repeatedly — uses UPSERT for idempotency
#
# Usage:
#   bash scripts/scrape-daily.sh          # normal run (uses /tmp cache if < 1h old)
#   bash scripts/scrape-daily.sh --force  # force fresh CDN fetch
#
# Cron example (every 30 min during event hours):
#   */30 8-22 * * * bash /opt/rmtv/scripts/scrape-daily.sh >> /var/log/rmtv-scrape.log 2>&1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/scrape.log"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo_step() { echo -e "${GREEN}[+]${NC} $(date '+%H:%M:%S') $1"; }
echo_warn() { echo -e "${YELLOW}[!]${NC} $(date '+%H:%M:%S') $1"; }
echo_err()  { echo -e "${RED}[x]${NC} $(date '+%H:%M:%S') $1"; }

FORCE_FLAG=""
if [ "${1:-}" = "--force" ]; then
    FORCE_FLAG="--force"
fi

echo_step "Starting daily scrape..."

# 1. Ensure PostgreSQL is running
if ! docker compose exec -T db pg_isready -U rmtv >/dev/null 2>&1; then
    echo_err "PostgreSQL is not running. Aborting."
    exit 1
fi

# 2. Run import script
echo_step "Running CDN import..."
cd "$SCRIPT_DIR"

if python3 import_rm_data.py $FORCE_FLAG; then
    echo_step "Scrape complete"
else
    echo_err "Scrape failed"
    exit 1
fi
