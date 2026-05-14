#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/.dev-pids"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}[+]${NC} Stopping RM.tv dev environment..."

# ── 1. Stop processes from PID file ────────────────────────────
if [ -f "$PID_FILE" ]; then
    read -r BACKEND_PID FRONTEND_PID < "$PID_FILE" 2>/dev/null || true
    if [ -n "${BACKEND_PID:-}" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null && echo "   Backend (PID $BACKEND_PID) stopped" || true
    fi
    if [ -n "${FRONTEND_PID:-}" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null && echo "   Frontend (PID $FRONTEND_PID) stopped" || true
    fi
    rm -f "$PID_FILE"
else
    echo "   No PID file found, trying process name matching..."
fi

# ── 2. Fallback: kill by process name ──────────────────────────
# Backend
if pgrep -f "target/debug/rmtv-backend" >/dev/null 2>&1; then
    pkill -f "target/debug/rmtv-backend" 2>/dev/null && echo "   Backend stopped (by name)" || true
fi

# Frontend (vite dev server)
if pgrep -f "vite" >/dev/null 2>&1; then
    pkill -f "vite" 2>/dev/null && echo "   Frontend stopped (by name)" || true
fi

# Cargo watch
if pgrep -f "cargo watch" >/dev/null 2>&1; then
    pkill -f "cargo watch" 2>/dev/null && echo "   Cargo watch stopped" || true
fi

# ── 3. Optionally stop PostgreSQL ──────────────────────────────
if [ "${1:-}" = "--all" ]; then
    cd "$PROJECT_DIR"
    docker compose down 2>/dev/null && echo "   PostgreSQL stopped" || true
    echo -e "${GREEN}[+]${NC} All services stopped"
else
    echo "   (PostgreSQL left running. Use '--all' to stop it too)"
fi
