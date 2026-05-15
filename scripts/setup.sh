#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[SETUP]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

cd "$(dirname "$0")/.."

log "RM.tv 一键环境配置"

# ── Prerequisites ──────────────────────────────────────────────────
log "检查前置依赖..."

command -v docker >/dev/null 2>&1 || err "请先安装 Docker: https://docs.docker.com/engine/install/"
command -v python3 >/dev/null 2>&1 || err "请先安装 Python 3"

# ── Rust ───────────────────────────────────────────────────────────
if ! command -v rustc >/dev/null 2>&1; then
    log "安装 Rust 工具链..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi

# Ensure cargo binaries are on PATH (both fresh install and pre-existing)
if [ -f "$HOME/.cargo/env" ]; then
    . "$HOME/.cargo/env"
fi
export PATH="$HOME/.cargo/bin:$PATH"
log "Rust: $(rustc --version)"

# ── Node.js ────────────────────────────────────────────────────────
# Always use nvm to ensure a compatible Node version (22+ for TypeScript 6.0)
export NVM_DIR="$HOME/.nvm"

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    log "安装 nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi

[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

NODE_MIN=22
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt "$NODE_MIN" ]; then
    log "安装 Node.js $NODE_MIN+ LTS..."
    nvm install --lts
    nvm alias default lts/*
fi
nvm use --lts 2>/dev/null || nvm use default
log "Node.js: $(node --version)"

# Install sqlx-cli if missing
if ! command -v sqlx >/dev/null 2>&1; then
    log "安装 sqlx-cli..."
    cargo install sqlx-cli --no-default-features --features postgres,rustls
    if ! command -v sqlx >/dev/null 2>&1; then
        err "sqlx-cli 安装失败，请检查 cargo install sqlx-cli 的输出"
    fi
fi

# ── Docker PostgreSQL ──────────────────────────────────────────────
log "启动 PostgreSQL..."
docker compose up -d --wait

DATABASE_URL="postgres://rmtv:rmtv_dev@localhost:5432/rmtv"
export DATABASE_URL

# ── Database Migrations ────────────────────────────────────────────
log "运行数据库迁移..."
cd backend
sqlx migrate run
cd ..

# ── Backend ────────────────────────────────────────────────────────
log "编译后端 (release)..."
cd backend
cargo build --release
cd ..

# ── Frontend ───────────────────────────────────────────────────────
log "安装前端依赖..."
cd frontend
npm install
log "构建前端..."
npm run build
cd ..

# ── Import Data ────────────────────────────────────────────────────
if [ "${IMPORT_DATA:-1}" = "1" ]; then
    log "导入历史比赛数据..."
    cd scripts
    python3 import_rm_data.py || warn "2026 数据导入失败（可能需要网络访问 CDN）"
    python3 import_historical_data.py || warn "历史数据导入失败（可能缺少 CSV 文件）"
    python3 compute_elo.py || warn "Elo 计算失败"
    cd ..
fi

# ── Done ───────────────────────────────────────────────────────────
echo ""
log "环境配置完成！"
echo ""
echo "  启动后端:  cd backend && cargo run --release"
echo "  启动前端:  cd frontend && npm run dev"
echo "  或者使用:  make backend-dev  /  make frontend-dev"
echo ""
echo "  API:       http://localhost:3000/api/health"
echo "  Frontend:  http://localhost:5173"
