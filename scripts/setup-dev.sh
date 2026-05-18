#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ─── 1. Dependency checks ─────────────────────────────────────────────────────

info "Checking required tools..."

check_tool() {
  local cmd="$1"
  local install_hint="$2"
  if ! command -v "$cmd" &>/dev/null; then
    error "$cmd is not installed. $install_hint"
  fi
  success "$cmd found: $(command -v "$cmd")"
}

check_tool "pnpm"   "Install via: npm install -g pnpm  or  https://pnpm.io/installation"
check_tool "docker" "Install via: https://docs.docker.com/get-docker/"
check_tool "go"     "Install via: https://go.dev/dl/"
check_tool "node"   "Install via: https://nodejs.org  or  nvm install 20"

NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  error "Node.js 20+ required, found v${NODE_VERSION}"
fi
success "Node.js v${NODE_VERSION}"

# ─── 2. Install dependencies ──────────────────────────────────────────────────

info "Installing dependencies with pnpm..."
pnpm install
success "Dependencies installed."

# ─── 3. Environment file ──────────────────────────────────────────────────────

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    success "Created .env from .env.example — review and update secrets before starting services."
  else
    warn ".env.example not found, skipping .env creation."
  fi
else
  info ".env already exists, skipping copy."
fi

# ─── 4. Start infrastructure containers ──────────────────────────────────────

info "Starting infrastructure containers (postgres, redis, rabbitmq, minio, clickhouse, mailhog)..."
docker compose up -d postgres redis rabbitmq minio clickhouse mailhog
success "Containers started."

# ─── 5. Wait for Postgres ─────────────────────────────────────────────────────

info "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-tudumm}" -d "${POSTGRES_DB:-tudumm}" &>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [[ "$RETRIES" -le 0 ]]; then
    error "PostgreSQL did not become ready in time. Check 'docker compose logs postgres'."
  fi
  echo -n "."
  sleep 1
done
echo ""
success "PostgreSQL is ready."

# ─── 6. Run DB migrations ─────────────────────────────────────────────────────

info "Running database migrations..."
pnpm db:migrate
success "Migrations complete."

# ─── 7. Generate Prisma client ────────────────────────────────────────────────

info "Generating Prisma client..."
pnpm db:generate
success "Prisma client generated."

# ─── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Dev environment ready!                             ║${NC}"
echo -e "${GREEN}║   Run 'pnpm dev' to start all services.              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
