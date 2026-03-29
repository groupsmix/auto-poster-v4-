#!/usr/bin/env bash
# ============================================================
# NEXUS — Deploy All Workers (Dependency Order)
# ============================================================
# Usage:
#   ./deploy.sh          # Deploy all workers
#   ./deploy.sh --dry    # Dry run (show commands only)
#   ./deploy.sh storage  # Deploy only nexus-storage
#   ./deploy.sh ai       # Deploy only nexus-ai
# ============================================================

set -euo pipefail

WORKERS_DIR="apps/workers"
DRY_RUN=false
TARGET=""

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --dry|--dry-run)
      DRY_RUN=true
      ;;
    *)
      TARGET="$arg"
      ;;
  esac
done

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

# Deploy a single worker
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

echo ""
echo "============================================"
echo "  NEXUS — Worker Deployment"
echo "============================================"
echo ""

# If a specific target is given, deploy only that worker
if [ -n "$TARGET" ]; then
  case "$TARGET" in
    storage|nexus-storage)
      deploy_worker "nexus-storage"
      ;;
    ai|nexus-ai)
      deploy_worker "nexus-ai"
      ;;
    variation|nexus-variation)
      deploy_worker "nexus-variation"
      ;;
    workflow|nexus-workflow)
      deploy_worker "nexus-workflow"
      ;;
    router|nexus-router)
      deploy_worker "nexus-router"
      ;;
    *)
      err "Unknown worker: $TARGET"
      echo "  Available: storage, ai, variation, workflow, router"
      exit 1
      ;;
  esac
  exit 0
fi

# Deploy ALL workers in dependency order:
#
# 1. nexus-storage  — no dependencies (foundation layer)
# 2. nexus-ai       — depends on nexus-storage (service binding)
# 3. nexus-variation — depends on nexus-ai + nexus-storage (service bindings)
# 4. nexus-workflow  — depends on nexus-ai + nexus-variation + nexus-storage
# 5. nexus-router    — depends on ALL other workers (API gateway)
#
# This order ensures each worker's service binding targets exist before deploy.

info "Deploy order: storage → ai → variation → workflow → router"
echo ""

deploy_worker "nexus-storage"
deploy_worker "nexus-ai"
deploy_worker "nexus-variation"
deploy_worker "nexus-workflow"
deploy_worker "nexus-router"

echo "============================================"
log "All 5 workers deployed successfully!"
echo "============================================"
echo ""
info "Next steps:"
info "  1. Set secrets: wrangler secret put <KEY> --name <worker-name>"
info "  2. Create D1 database: wrangler d1 create nexus-db"
info "  3. Create KV namespace: wrangler kv namespace create CACHE"
info "  4. Create R2 bucket: wrangler r2 bucket create nexus-assets"
info "  5. Update placeholder IDs in wrangler.toml files with real IDs"
info "  6. Re-deploy after updating IDs: ./deploy.sh"
echo ""
