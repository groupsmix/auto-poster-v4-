#!/usr/bin/env bash
# ============================================================
# NEXUS — Full Deployment Script
# ============================================================
# Handles the complete deployment pipeline:
#   1. D1 database migrations
#   2. Seed prompts, domains, categories, platforms, social channels, AI models
#   3. Deploy all 5 workers in dependency order
#   4. Deploy frontend to CF Pages
#   5. Set all secrets
#
# Usage:
#   ./deploy.sh              # Full deploy (migrations + seed + workers + pages)
#   ./deploy.sh --dry        # Dry run (show commands only)
#   ./deploy.sh --workers    # Deploy workers only (skip migrations/seed/pages)
#   ./deploy.sh --migrate    # Run migrations only
#   ./deploy.sh --seed       # Run seed script only
#   ./deploy.sh --pages      # Deploy CF Pages only
#   ./deploy.sh --secrets    # Set all secrets interactively
#   ./deploy.sh storage      # Deploy a single worker
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKERS_DIR="apps/workers"
MIGRATIONS_DIR="migrations"
FRONTEND_DIR="apps/web"
DRY_RUN=false
TARGET=""
MODE="full"  # full, workers, migrate, seed, pages, secrets

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --dry|--dry-run)
      DRY_RUN=true
      ;;
    --workers)
      MODE="workers"
      ;;
    --migrate)
      MODE="migrate"
      ;;
    --seed)
      MODE="seed"
      ;;
    --pages)
      MODE="pages"
      ;;
    --secrets)
      MODE="secrets"
      ;;
    *)
      TARGET="$arg"
      MODE="single"
      ;;
  esac
done

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# ── Step 1: D1 Migrations ──────────────────────────────────
run_migrations() {
  step "Running D1 database migrations..."

  # Ensure _migrations tracking table exists
  log "Ensuring _migrations tracking table exists..."
  if [ "$DRY_RUN" = true ]; then
    info "  (dry run) wrangler d1 execute nexus-db --file=${MIGRATIONS_DIR}/000_migrations_tracker.sql --remote"
  else
    npx wrangler d1 execute nexus-db --file="${MIGRATIONS_DIR}/000_migrations_tracker.sql" --remote
  fi

  local migration_count=0
  for migration in $(ls ${MIGRATIONS_DIR}/*.sql 2>/dev/null | sort); do
    local basename
    basename=$(basename "$migration")

    if [ "$DRY_RUN" = true ]; then
      info "  (dry run) wrangler d1 execute nexus-db --file=$migration --remote"
      migration_count=$((migration_count + 1))
      continue
    fi

    # Skip if already applied
    local applied
    applied=$(npx wrangler d1 execute nexus-db --command "SELECT 1 FROM _migrations WHERE name='$basename'" --remote --json 2>/dev/null || echo "[]")
    if echo "$applied" | grep -q '"1"'; then
      info "Skipping $basename (already applied)"
      continue
    fi

    log "Applying migration: $basename"
    npx wrangler d1 execute nexus-db --file="$migration" --remote
    npx wrangler d1 execute nexus-db --command "INSERT OR IGNORE INTO _migrations (name) VALUES ('$basename')" --remote
    log "Migration $basename applied successfully"
    migration_count=$((migration_count + 1))
  done

  if [ "$migration_count" -eq 0 ]; then
    log "No new migrations to apply (all already applied)"
  fi

  echo ""
}

# ── Step 2: Seed Data ──────────────────────────────────────
run_seed() {
  step "Seeding prompts, domains, categories, platforms, social channels, AI models..."

  if [ "$DRY_RUN" = true ]; then
    info "  (dry run) npx tsx scripts/seed-prompts.ts"
  else
    npx tsx scripts/seed-prompts.ts
  fi

  log "Seed script completed"
  echo ""
}

# ── Step 3: Deploy Workers ─────────────────────────────────
deploy_worker() {
  local name=$1
  local dir="${WORKERS_DIR}/${name}"

  if [ ! -d "$dir" ]; then
    err "Worker directory not found: $dir"
    return 1
  fi

  log "Deploying ${name}..."

  if [ "$DRY_RUN" = true ]; then
    info "  (dry run) wrangler deploy --config ${dir}/wrangler.toml"
  else
    (cd "$dir" && npx wrangler deploy)
  fi

  log "${name} deployed successfully!"
  echo ""
}

deploy_all_workers() {
  step "Deploying all 5 workers in dependency order..."
  info "Order: nexus-storage → nexus-ai → nexus-variation → nexus-workflow → nexus-router"
  echo ""

  # Deploy in dependency order:
  # 1. nexus-storage  — no dependencies (foundation layer)
  # 2. nexus-ai       — depends on nexus-storage (service binding)
  # 3. nexus-variation — depends on nexus-ai + nexus-storage (service bindings)
  # 4. nexus-workflow  — depends on nexus-ai + nexus-variation + nexus-storage
  # 5. nexus-router    — depends on ALL other workers (API gateway)
  deploy_worker "nexus-storage"
  deploy_worker "nexus-ai"
  deploy_worker "nexus-variation"
  deploy_worker "nexus-workflow"
  deploy_worker "nexus-router"

  log "All 5 workers deployed successfully!"
  echo ""
}

# ── Step 4: Deploy Frontend (CF Pages) ─────────────────────
deploy_pages() {
  step "Deploying frontend to Cloudflare Pages..."

  if [ ! -d "$FRONTEND_DIR" ]; then
    err "Frontend directory not found: $FRONTEND_DIR"
    return 1
  fi

  log "Building frontend..."
  if [ "$DRY_RUN" = true ]; then
    info "  (dry run) cd $FRONTEND_DIR && pnpm run build"
    info "  (dry run) npx wrangler pages deploy out --project-name=nexus-dashboard"
  else
    (cd "$FRONTEND_DIR" && NEXT_PUBLIC_API_URL="https://nexus-router.${CF_SUBDOMAIN:-professional-inbox-simo}.workers.dev/api" pnpm run build)
    (cd "$FRONTEND_DIR" && npx wrangler pages deploy out --project-name=nexus-dashboard)
  fi

  log "Frontend deployed to CF Pages!"
  echo ""
}

# ── Step 5: Set Secrets ────────────────────────────────────
set_secrets() {
  step "Setting worker secrets..."

  # List of all secrets that need to be set across workers
  # AI API keys (set on nexus-ai)
  local AI_SECRETS=(
    "DEEPSEEK_API_KEY"
    "SILICONFLOW_API_KEY"
    "MOONSHOT_API_KEY"
    "GROQ_API_KEY"
    "FIREWORKS_API_KEY"
    "HF_TOKEN"
    "TAVILY_API_KEY"
    "EXA_API_KEY"
    "SERPAPI_KEY"
    "DATAFORSEO_KEY"
    "FAL_API_KEY"
    "IDEOGRAM_API_KEY"
    "SEGMIND_API_KEY"
    "CLIPDROP_API_KEY"
    "SUNO_API_KEY"
    "UDIO_API_KEY"
    "MINIMAX_API_KEY"
    "PRINTFUL_API_KEY"
    "PRINTIFY_API_KEY"
    "GOOGLE_API_KEY"
  )

  # Storage secrets
  local STORAGE_SECRETS=(
    "CF_ACCOUNT_ID"
    "CF_IMAGES_TOKEN"
  )

  # Router secrets (auth)
  local ROUTER_SECRETS=(
    "DASHBOARD_SECRET"
  )

  if [ "$DRY_RUN" = true ]; then
    info "Secrets to set on nexus-ai:"
    for secret in "${AI_SECRETS[@]}"; do
      info "  wrangler secret put $secret --name nexus-ai"
    done
    info ""
    info "Secrets to set on nexus-storage:"
    for secret in "${STORAGE_SECRETS[@]}"; do
      info "  wrangler secret put $secret --name nexus-storage"
    done
    info ""
    info "Secrets to set on nexus-router:"
    for secret in "${ROUTER_SECRETS[@]}"; do
      info "  wrangler secret put $secret --name nexus-router"
    done
  else
    warn "Interactive secret setting — you will be prompted for each value."
    warn "Press Ctrl+C to skip remaining secrets."
    echo ""

    for secret in "${AI_SECRETS[@]}"; do
      log "Setting $secret on nexus-ai..."
      npx wrangler secret put "$secret" --name nexus-ai || warn "Skipped $secret"
    done

    for secret in "${STORAGE_SECRETS[@]}"; do
      log "Setting $secret on nexus-storage..."
      npx wrangler secret put "$secret" --name nexus-storage || warn "Skipped $secret"
    done

    for secret in "${ROUTER_SECRETS[@]}"; do
      log "Setting $secret on nexus-router..."
      npx wrangler secret put "$secret" --name nexus-router || warn "Skipped $secret"
    done
  fi

  echo ""
  log "Secrets configuration complete!"
  echo ""
}

# ── Main Entry Point ──────────────────────────────────────

echo ""
echo "============================================================"
echo "  NEXUS — Full Deployment Pipeline"
echo "============================================================"
echo ""

if [ "$DRY_RUN" = true ]; then
  warn "DRY RUN MODE — no changes will be made"
  echo ""
fi

case "$MODE" in
  single)
    # Deploy a single worker
    case "$TARGET" in
      storage|nexus-storage)   deploy_worker "nexus-storage" ;;
      ai|nexus-ai)             deploy_worker "nexus-ai" ;;
      variation|nexus-variation) deploy_worker "nexus-variation" ;;
      workflow|nexus-workflow)  deploy_worker "nexus-workflow" ;;
      router|nexus-router)     deploy_worker "nexus-router" ;;
      *)
        err "Unknown worker: $TARGET"
        echo "  Available: storage, ai, variation, workflow, router"
        exit 1
        ;;
    esac
    ;;

  migrate)
    run_migrations
    ;;

  seed)
    run_seed
    ;;

  workers)
    deploy_all_workers
    ;;

  pages)
    deploy_pages
    ;;

  secrets)
    set_secrets
    ;;

  full)
    # Full deployment pipeline
    step "Starting full deployment pipeline..."
    echo ""

    # Pre-deploy safety checks (typecheck + lint)
    if [ "$DRY_RUN" != true ]; then
      step "Running pre-deploy checks..."
      info "Running typecheck..."
      if ! pnpm typecheck 2>/dev/null; then
        err "Typecheck failed! Fix type errors before deploying."
        exit 1
      fi
      log "Typecheck passed"

      info "Running lint..."
      if ! pnpm lint 2>/dev/null; then
        warn "Lint has warnings/errors. Proceeding anyway."
      fi

      # Confirmation prompt
      echo ""
      warn "About to deploy ALL workers + frontend to production."
      echo -n "Continue? [y/N] "
      read -r confirm
      if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        info "Deployment cancelled."
        exit 0
      fi
      echo ""
    fi

    # 1. Migrations
    run_migrations

    # 2. Seed data
    run_seed

    # 3. Deploy workers (stop on failure — dependency order matters)
    deploy_all_workers

    # 4. Deploy frontend
    deploy_pages

    # 5. Show secrets reminder
    echo "============================================================"
    log "Full deployment pipeline complete!"
    echo "============================================================"
    echo ""
    info "Post-deploy checklist:"
    info "  1. Run './deploy.sh --secrets' to set API keys (if not already done)"
    info "  2. Verify workers: curl https://nexus-router.<account>.workers.dev/health"
    info "  3. Verify dashboard: visit your CF Pages URL"
    info "  4. Run a test workflow through the dashboard"
    echo ""
    info "To re-deploy a single worker:"
    info "  ./deploy.sh storage   # or: ai, variation, workflow, router"
    echo ""
    ;;
esac
