#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

warn "This will DESTROY all local dev data (DB, Redis, MinIO, etc.) and start fresh."
read -r -p "Are you sure? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  info "Aborted."
  exit 0
fi

# ─── Stop all containers ──────────────────────────────────────────────────────

info "Stopping all containers..."
docker compose down --remove-orphans
success "Containers stopped."

# ─── Drop volumes (DB data, Redis, MinIO, etc.) ───────────────────────────────

info "Removing volumes..."
docker compose down --volumes
success "Volumes removed."

# ─── Remove any leftover images built locally ─────────────────────────────────

info "Pruning dangling images..."
docker image prune -f
success "Dangling images pruned."

# ─── Restart fresh ────────────────────────────────────────────────────────────

info "Restarting infrastructure from scratch..."
docker compose up -d postgres redis rabbitmq minio clickhouse mailhog
success "Containers restarted."

# ─── Wait for Postgres ────────────────────────────────────────────────────────

info "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-tudumm}" -d "${POSTGRES_DB:-tudumm}" &>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [[ "$RETRIES" -le 0 ]]; then
    error "PostgreSQL did not become ready in time."
  fi
  echo -n "."
  sleep 1
done
echo ""
success "PostgreSQL is ready."

# ─── Migrate & generate ───────────────────────────────────────────────────────

info "Running database migrations..."
pnpm db:migrate
success "Migrations complete."

info "Generating Prisma client..."
pnpm db:generate
success "Prisma client generated."

echo ""
echo -e "${GREEN}Dev environment reset complete! Run 'pnpm dev' to start all services.${NC}"
