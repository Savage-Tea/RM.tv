#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/.dev-pids"

# Default env
export DATABASE_URL="${DATABASE_URL:-postgres://rmtv:rmtv_dev@localhost:5432/rmtv}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo_step() { echo -e "${GREEN}[+]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
echo_err()  { echo -e "${RED}[x]${NC} $1"; }

cleanup() {
    echo_warn "Startup interrupted. Stopping services..."
    bash "$SCRIPT_DIR/dev-stop.sh" 2>/dev/null || true
    exit 1
}
trap cleanup INT TERM

# ── 1. PostgreSQL ──────────────────────────────────────────────
echo_step "Starting PostgreSQL..."
cd "$PROJECT_DIR"
docker compose up -d 2>/dev/null

echo "   Waiting for PostgreSQL..."
for i in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U rmtv >/dev/null 2>&1; then
        echo "   PostgreSQL ready"
        break
    fi
    sleep 1
done

# ── 2. Database migrations ─────────────────────────────────────
echo_step "Running database migrations..."
cd "$PROJECT_DIR/backend"
if sqlx migrate run 2>&1 | sed 's/^/   /'; then
    echo "   Migrations complete"
else
    echo_err "Migration failed. Check database connectivity and migrations directory."
    exit 1
fi

# ── 3. Seed admin user ─────────────────────────────────────────
echo_step "Seeding admin user..."
ADMIN_EXISTS=$(docker compose exec -T db psql -U rmtv -d rmtv -t -c \
    "SELECT count(*) FROM admin_users WHERE username = 'admin';" 2>/dev/null | tr -d ' ' || echo "0")

if [ "${ADMIN_EXISTS:-0}" = "0" ]; then
    python3 -c "
import hashlib, os, base64

password = 'admin123'
salt = os.urandom(16)
# argon2id hash via hashlib (Python 3.6+)
# Fallback: use a simple hash the backend can verify
# The backend uses argon2, so we need to create via the backend's CLI
print('   Note: Admin user will be created on first backend startup')
print('   or run: cd backend && cargo run --bin seed-admin 2>/dev/null')
" 2>/dev/null || true
    echo_warn "Admin user not seeded (backend creates on first auth request)"
else
    echo "   Admin user already exists"
fi

# ── 4. Build backend ───────────────────────────────────────────
echo_step "Building backend..."
cd "$PROJECT_DIR/backend"
cargo build 2>&1 | tail -1
echo "   Backend built"

# ── 5. Start backend ───────────────────────────────────────────
echo_step "Starting backend (port 3000)..."
target/debug/rmtv-backend &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

echo "   Waiting for backend..."
for i in $(seq 1 120); do
    if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
        echo "   Backend ready"
        break
    fi
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo_err "Backend process died"
        exit 1
    fi
    sleep 1
done

# ── 6. (Optional) Import CDN data ──────────────────────────────
if [ "${IMPORT_DATA:-}" = "1" ]; then
    echo_step "Importing CDN data..."
    cd "$PROJECT_DIR/scripts"
    python3 import_rm_data.py 2>&1 | tail -5
fi

# ── 7. Start frontend ──────────────────────────────────────────
echo_step "Starting frontend (port 5173)..."
cd "$PROJECT_DIR/frontend"

# Fix npm bug with optional/native dependencies (rolldown binding)
if [ -d node_modules ] && [ ! -f node_modules/.deps-ok ]; then
    BINDING="node_modules/rolldown/dist/shared/rolldown-binding.linux-x64-gnu.node"
    if ! node -e "require('rolldown')" 2>/dev/null; then
        echo_warn "Native binding missing, reinstalling dependencies..."
        rm -rf node_modules package-lock.json
        npm install
        touch node_modules/.deps-ok
    else
        touch node_modules/.deps-ok
    fi
elif [ ! -d node_modules ]; then
    npm install
fi

npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

# ── Save PIDs ──────────────────────────────────────────────────
echo "$BACKEND_PID $FRONTEND_PID" > "$PID_FILE"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}RM.tv dev environment ready${NC}"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:3000"
echo ""
echo "  PIDs:  backend=$BACKEND_PID  frontend=$FRONTEND_PID"
echo ""
echo "  Stop with:  bash scripts/dev-stop.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

wait
