#!/usr/bin/env bash
# ============================================================
# NEXUS — One-Command Disaster Recovery / Bootstrap Script
# ============================================================
# Recreates ALL Cloudflare infrastructure from a fresh git clone.
# Run this once to go from zero → fully deployed NEXUS.
#
# What it does (in order):
#   1. Installs dependencies (pnpm install)
#   2. Creates Cloudflare resources (D1, KV, R2) — skips if they exist
#   3. Auto-updates all wrangler.toml files with real resource IDs
#   4. Builds the entire monorepo
#   5. Runs D1 database migrations (all migration files)
#   6. Seeds prompt templates, domains, categories, platforms, etc.
#   7. Deploys all 5 workers in dependency order
#   8. Deploys the Next.js frontend to CF Pages
#   9. Prints a summary with URLs and next steps
#
# Usage:
#   ./bootstrap.sh                  # Full bootstrap (interactive — asks for secrets)
#   ./bootstrap.sh --dry            # Dry run (show what would happen, change nothing)
#   ./bootstrap.sh --skip-secrets   # Skip secret prompts (set them later via deploy.sh --secrets)
#   ./bootstrap.sh --infrastructure # Only create resources + update IDs (no deploy)
#   ./bootstrap.sh --status         # Show current resource status
#
# Prerequisites:
#   - Node.js 18+ and pnpm installed
#   - Wrangler authenticated: npx wrangler login
#   - Git repo cloned with all code
#
# Disaster Recovery:
#   If you lose your Cloudflare account or delete resources:
#     1. git clone https://github.com/groupsmix/auto-poster-v4-.git
#     2. cd auto-poster-v4-/nexus
#     3. npx wrangler login
#     4. ./bootstrap.sh
#   That's it. Everything comes back.
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

WORKERS_DIR="apps/workers"
MIGRATIONS_DIR="migrations"
FRONTEND_DIR="apps/web"
DRY_RUN=false
SKIP_SECRETS=false
MODE="full"  # full, dry, infrastructure, status

# Resource names (single source of truth)
D1_DB_NAME="nexus-db"
KV_NAMESPACE_NAME="CACHE"
R2_BUCKET_NAME="nexus-assets"
PAGES_PROJECT="nexus-dashboard"

# Captured resource IDs (populated during bootstrap)
D1_ID=""
KV_ID=""

# ── Parse Arguments ──────────────────────────────────────────

for arg in "$@"; do
  case "$arg" in
    --dry|--dry-run)
      DRY_RUN=true
      ;;
    --skip-secrets)
      SKIP_SECRETS=true
      ;;
    --infrastructure|--infra)
      MODE="infrastructure"
      ;;
    --status)
      MODE="status"
      ;;
    --help|-h)
      head -38 "$0" | tail -34
      exit 0
      ;;
  esac
done

# ── Colors ───────────────────────────────────────────────────

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${GREEN}[BOOTSTRAP]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()     { echo -e "${RED}[ERROR]${NC} $1"; }
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
step()    { echo -e "\n${CYAN}${BOLD}━━━ Step $1 ━━━${NC}"; }
success() { echo -e "${GREEN}${BOLD}$1${NC}"; }

# ── Pre-flight Checks ───────────────────────────────────────

preflight() {
  log "Running pre-flight checks..."

  # Check Node.js
  if ! command -v node &> /dev/null; then
    err "Node.js is not installed. Install Node.js 18+ first."
    exit 1
  fi
  local node_version
  node_version=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$node_version" -lt 18 ]; then
    err "Node.js 18+ required. Found: $(node -v)"
    exit 1
  fi
  info "Node.js $(node -v)"

  # Check pnpm
  if ! command -v pnpm &> /dev/null; then
    warn "pnpm not found. Installing..."
    npm install -g pnpm@9
  fi
  info "pnpm $(pnpm -v)"

  # Check wrangler auth
  if ! npx wrangler whoami &> /dev/null 2>&1; then
    err "Wrangler is not authenticated. Run: npx wrangler login"
    exit 1
  fi
  info "Wrangler authenticated"

  log "Pre-flight checks passed!"
}

# ── Step 1: Install Dependencies ─────────────────────────────

install_deps() {
  step "1: Installing dependencies"

  if [ "$DRY_RUN" = true ]; then
    info "(dry run) pnpm install"
    return
  fi

  pnpm install
  log "Dependencies installed"
}

# ── Step 2: Create Cloudflare Resources ──────────────────────

create_d1() {
  log "Checking D1 database '${D1_DB_NAME}'..."

  # Check if D1 database already exists
  local existing
  existing=$(npx wrangler d1 list 2>/dev/null | grep -w "$D1_DB_NAME" || true)

  if [ -n "$existing" ]; then
    info "D1 database '${D1_DB_NAME}' already exists"
    # Extract the ID from the existing database
    D1_ID=$(npx wrangler d1 list 2>/dev/null | grep -w "$D1_DB_NAME" | awk '{print $1}')
    if [ -z "$D1_ID" ]; then
      # Try alternative parsing — some wrangler versions output differently
      D1_ID=$(npx wrangler d1 list --json 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
for db in data:
    if db.get('name') == '${D1_DB_NAME}':
        print(db['uuid'])
        break
" 2>/dev/null || true)
    fi
  else
    if [ "$DRY_RUN" = true ]; then
      info "(dry run) wrangler d1 create ${D1_DB_NAME}"
      D1_ID="dry-run-d1-id"
      return
    fi

    log "Creating D1 database '${D1_DB_NAME}'..."
    local output
    output=$(npx wrangler d1 create "$D1_DB_NAME" 2>&1)
    echo "$output"

    # Extract database_id from output
    D1_ID=$(echo "$output" | grep -oP 'database_id\s*=\s*"\K[^"]+' || true)
    if [ -z "$D1_ID" ]; then
      # Try alternative pattern
      D1_ID=$(echo "$output" | grep -oP '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1 || true)
    fi
  fi

  if [ -z "$D1_ID" ]; then
    err "Could not extract D1 database ID. Check output above and update wrangler.toml files manually."
    err "Set D1_ID= and re-run, or update placeholder-d1-id in all wrangler.toml files."
    exit 1
  fi

  success "D1 database ID: ${D1_ID}"
}

create_kv() {
  log "Checking KV namespace '${KV_NAMESPACE_NAME}'..."

  # Check if KV namespace already exists
  local existing
  existing=$(npx wrangler kv namespace list 2>/dev/null | grep -w "$KV_NAMESPACE_NAME" || true)

  if [ -n "$existing" ]; then
    info "KV namespace '${KV_NAMESPACE_NAME}' already exists"
    # Extract the ID
    KV_ID=$(npx wrangler kv namespace list --json 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
for ns in data:
    if '${KV_NAMESPACE_NAME}' in ns.get('title', ''):
        print(ns['id'])
        break
" 2>/dev/null || true)
  else
    if [ "$DRY_RUN" = true ]; then
      info "(dry run) wrangler kv namespace create ${KV_NAMESPACE_NAME}"
      KV_ID="dry-run-kv-id"
      return
    fi

    log "Creating KV namespace '${KV_NAMESPACE_NAME}'..."
    local output
    output=$(npx wrangler kv namespace create "$KV_NAMESPACE_NAME" 2>&1)
    echo "$output"

    # Extract namespace ID from output
    KV_ID=$(echo "$output" | grep -oP 'id\s*=\s*"\K[^"]+' || true)
    if [ -z "$KV_ID" ]; then
      KV_ID=$(echo "$output" | grep -oP '[0-9a-f]{32}' | head -1 || true)
    fi
  fi

  if [ -z "$KV_ID" ]; then
    err "Could not extract KV namespace ID. Check output above and update wrangler.toml files manually."
    exit 1
  fi

  success "KV namespace ID: ${KV_ID}"
}

create_r2() {
  log "Checking R2 bucket '${R2_BUCKET_NAME}'..."

  # Check if R2 bucket already exists
  local existing
  existing=$(npx wrangler r2 bucket list 2>/dev/null | grep -w "$R2_BUCKET_NAME" || true)

  if [ -n "$existing" ]; then
    info "R2 bucket '${R2_BUCKET_NAME}' already exists"
  else
    if [ "$DRY_RUN" = true ]; then
      info "(dry run) wrangler r2 bucket create ${R2_BUCKET_NAME}"
      return
    fi

    log "Creating R2 bucket '${R2_BUCKET_NAME}'..."
    npx wrangler r2 bucket create "$R2_BUCKET_NAME"
  fi

  success "R2 bucket: ${R2_BUCKET_NAME}"
}

create_resources() {
  step "2: Creating Cloudflare resources"
  create_d1
  create_kv
  create_r2
  log "All Cloudflare resources ready!"
}

# ── Step 3: Update wrangler.toml Files ───────────────────────

update_wrangler_configs() {
  step "3: Updating wrangler.toml files with resource IDs"

  if [ "$DRY_RUN" = true ]; then
    info "(dry run) Would replace placeholder-d1-id with ${D1_ID}"
    info "(dry run) Would replace placeholder-kv-id with ${KV_ID}"
    return
  fi

  if [ -z "$D1_ID" ] || [ -z "$KV_ID" ]; then
    err "Missing resource IDs. D1_ID=${D1_ID}, KV_ID=${KV_ID}"
    exit 1
  fi

  # Files that contain placeholder-d1-id
  local d1_files=(
    "${WORKERS_DIR}/nexus-ai/wrangler.toml"
    "${WORKERS_DIR}/nexus-storage/wrangler.toml"
    "${WORKERS_DIR}/nexus-workflow/wrangler.toml"
  )

  # Files that contain placeholder-kv-id
  local kv_files=(
    "${WORKERS_DIR}/nexus-ai/wrangler.toml"
    "${WORKERS_DIR}/nexus-storage/wrangler.toml"
    "${WORKERS_DIR}/nexus-workflow/wrangler.toml"
    "${WORKERS_DIR}/nexus-variation/wrangler.toml"
  )

  for file in "${d1_files[@]}"; do
    if [ -f "$file" ]; then
      sed -i "s/placeholder-d1-id/${D1_ID}/g" "$file"
      log "Updated D1 ID in $file"
    fi
  done

  for file in "${kv_files[@]}"; do
    if [ -f "$file" ]; then
      sed -i "s/placeholder-kv-id/${KV_ID}/g" "$file"
      log "Updated KV ID in $file"
    fi
  done

  success "All wrangler.toml files updated with real resource IDs"
}

# ── Step 4: Build ─────────────────────────────────────────────

build_project() {
  step "4: Building the monorepo"

  if [ "$DRY_RUN" = true ]; then
    info "(dry run) pnpm run build"
    return
  fi

  # Set API URL for frontend build (uses the router worker URL)
  export NEXT_PUBLIC_API_URL="https://nexus-router.${CF_SUBDOMAIN:-professional-inbox-simo}.workers.dev/api"
  pnpm run build
  log "Build completed successfully"
}

# ── Step 5: Run Migrations ───────────────────────────────────

run_migrations() {
  step "5: Running D1 database migrations"

  # Ensure _migrations tracking table exists
  log "Ensuring _migrations tracking table exists..."
  if [ "$DRY_RUN" = true ]; then
    info "  (dry run) wrangler d1 execute ${D1_DB_NAME} --file=${MIGRATIONS_DIR}/000_migrations_tracker.sql --remote"
  else
    npx wrangler d1 execute "$D1_DB_NAME" --file="${MIGRATIONS_DIR}/000_migrations_tracker.sql" --remote
  fi

  local migration_count=0
  for migration in $(ls ${MIGRATIONS_DIR}/*.sql 2>/dev/null | sort); do
    local basename
    basename=$(basename "$migration")

    if [ "$DRY_RUN" = true ]; then
      info "  (dry run) wrangler d1 execute ${D1_DB_NAME} --file=$migration --remote"
      migration_count=$((migration_count + 1))
      continue
    fi

    # Skip if already applied
    local applied
    applied=$(npx wrangler d1 execute "$D1_DB_NAME" --command "SELECT 1 FROM _migrations WHERE name='$basename'" --remote --json 2>/dev/null || echo "[]")
    if echo "$applied" | grep -q '"1"'; then
      info "Skipping $basename (already applied)"
      continue
    fi

    log "Applying migration: $basename"
    npx wrangler d1 execute "$D1_DB_NAME" --file="$migration" --remote
    npx wrangler d1 execute "$D1_DB_NAME" --command "INSERT OR IGNORE INTO _migrations (name) VALUES ('$basename')" --remote
    log "Migration $basename applied"
    migration_count=$((migration_count + 1))
  done

  if [ "$migration_count" -eq 0 ]; then
    log "No new migrations to apply (all already applied)"
  else
    log "All $migration_count new migrations applied"
  fi
}

# ── Step 6: Seed Data ────────────────────────────────────────

run_seed() {
  step "6: Seeding prompt templates and reference data"

  if [ "$DRY_RUN" = true ]; then
    info "(dry run) npx tsx scripts/seed-prompts.ts"
    return
  fi

  # Seed prompts (will show local preview if no CF credentials set)
  npx tsx scripts/seed-prompts.ts || warn "Prompt seeding skipped (set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN to seed remotely)"

  log "Seed step complete"
}

# ── Step 7: Deploy Workers ───────────────────────────────────

deploy_worker() {
  local name=$1
  local dir="${WORKERS_DIR}/${name}"

  if [ ! -d "$dir" ]; then
    err "Worker directory not found: $dir"
    return 1
  fi

  log "Deploying ${name}..."

  if [ "$DRY_RUN" = true ]; then
    info "  (dry run) cd $dir && npx wrangler deploy"
  else
    (cd "$dir" && npx wrangler deploy)
  fi

  log "${name} deployed!"
}

deploy_all_workers() {
  step "7: Deploying all 5 workers (dependency order)"
  info "Order: nexus-storage → nexus-ai → nexus-variation → nexus-workflow → nexus-router"

  deploy_worker "nexus-storage"
  deploy_worker "nexus-ai"
  deploy_worker "nexus-variation"
  deploy_worker "nexus-workflow"
  deploy_worker "nexus-router"

  log "All 5 workers deployed!"
}

# ── Step 8: Deploy Frontend ──────────────────────────────────

deploy_frontend() {
  step "8: Deploying frontend to Cloudflare Pages"

  if [ ! -d "$FRONTEND_DIR" ]; then
    err "Frontend directory not found: $FRONTEND_DIR"
    return 1
  fi

  if [ "$DRY_RUN" = true ]; then
    info "(dry run) cd $FRONTEND_DIR && npx wrangler pages deploy out --project-name=${PAGES_PROJECT}"
    return
  fi

  (cd "$FRONTEND_DIR" && npx wrangler pages deploy out --project-name="${PAGES_PROJECT}")

  log "Frontend deployed to CF Pages!"
}

# ── Step 9: Set Secrets (Optional) ───────────────────────────

set_minimum_secrets() {
  step "9: Setting required secrets"

  if [ "$SKIP_SECRETS" = true ]; then
    info "Skipping secrets (--skip-secrets). Run './deploy.sh --secrets' later."
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    info "(dry run) Would prompt for: DASHBOARD_SECRET, DEEPSEEK_API_KEY"
    return
  fi

  echo ""
  warn "You need at minimum 2 secrets to get started:"
  echo "  1. DASHBOARD_SECRET — any password you choose for dashboard access"
  echo "  2. DEEPSEEK_API_KEY — get a free key at https://platform.deepseek.com"
  echo ""
  echo "Press Enter to set them now, or Ctrl+C to skip (set later via ./deploy.sh --secrets)"
  read -r

  log "Setting DASHBOARD_SECRET on nexus-router..."
  npx wrangler secret put DASHBOARD_SECRET --name nexus-router || warn "Skipped DASHBOARD_SECRET"

  log "Setting DEEPSEEK_API_KEY on nexus-ai..."
  npx wrangler secret put DEEPSEEK_API_KEY --name nexus-ai || warn "Skipped DEEPSEEK_API_KEY"

  echo ""
  info "Minimum secrets set. Add more AI keys later with: ./deploy.sh --secrets"
}

# ── Status Command ───────────────────────────────────────────

show_status() {
  echo ""
  echo "============================================================"
  echo "  NEXUS — Infrastructure Status"
  echo "============================================================"
  echo ""

  echo "── D1 Databases ──"
  npx wrangler d1 list 2>/dev/null | grep -w "$D1_DB_NAME" || warn "D1 database '${D1_DB_NAME}' not found"
  echo ""

  echo "── KV Namespaces ──"
  npx wrangler kv namespace list 2>/dev/null | grep -w "$KV_NAMESPACE_NAME" || warn "KV namespace '${KV_NAMESPACE_NAME}' not found"
  echo ""

  echo "── R2 Buckets ──"
  npx wrangler r2 bucket list 2>/dev/null | grep -w "$R2_BUCKET_NAME" || warn "R2 bucket '${R2_BUCKET_NAME}' not found"
  echo ""

  echo "── Wrangler.toml Placeholder Status ──"
  local has_placeholders=false
  for file in ${WORKERS_DIR}/*/wrangler.toml; do
    if grep -q "placeholder-" "$file" 2>/dev/null; then
      warn "$file still has placeholder IDs"
      has_placeholders=true
    else
      info "$file — IDs configured"
    fi
  done

  if [ "$has_placeholders" = false ]; then
    success "All wrangler.toml files have real resource IDs"
  fi

  echo ""
}

# ── Final Summary ────────────────────────────────────────────

print_summary() {
  echo ""
  echo "============================================================"
  success "  NEXUS — Bootstrap Complete!"
  echo "============================================================"
  echo ""
  info "Your NEXUS system is deployed and ready."
  echo ""
  info "Resource IDs (saved in wrangler.toml files):"
  info "  D1 Database ID : ${D1_ID}"
  info "  KV Namespace ID: ${KV_ID}"
  info "  R2 Bucket      : ${R2_BUCKET_NAME}"
  echo ""
  info "Quick verification:"
  info "  curl https://nexus-router.<your-subdomain>.workers.dev/health"
  echo ""
  info "Dashboard:"
  info "  Visit your CF Pages URL (check CF dashboard → Pages → ${PAGES_PROJECT})"
  echo ""
  info "Useful commands:"
  info "  ./deploy.sh --secrets    # Add more AI API keys"
  info "  ./deploy.sh router       # Re-deploy a single worker"
  info "  ./deploy.sh --pages      # Re-deploy frontend only"
  info "  ./bootstrap.sh --status  # Check infrastructure status"
  echo ""
  info "Disaster recovery (if you ever need to start fresh):"
  info "  git clone https://github.com/groupsmix/auto-poster-v4-.git"
  info "  cd auto-poster-v4-/nexus && npx wrangler login && ./bootstrap.sh"
  echo ""
}

# ── Main Entry Point ─────────────────────────────────────────

echo ""
echo "============================================================"
echo "  NEXUS — One-Command Bootstrap / Disaster Recovery"
echo "============================================================"
echo ""

if [ "$DRY_RUN" = true ]; then
  warn "DRY RUN MODE — nothing will be created or deployed"
  echo ""
fi

case "$MODE" in
  status)
    show_status
    ;;

  infrastructure)
    preflight
    install_deps
    create_resources
    update_wrangler_configs
    build_project
    echo ""
    success "Infrastructure ready! Run './bootstrap.sh' to complete the full deploy."
    ;;

  full)
    preflight
    install_deps
    create_resources
    update_wrangler_configs
    build_project
    run_migrations
    run_seed
    deploy_all_workers
    deploy_frontend
    set_minimum_secrets
    print_summary
    ;;
esac
