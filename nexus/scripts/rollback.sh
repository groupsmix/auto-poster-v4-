#!/usr/bin/env bash
# ============================================================
# NEXUS — Emergency Rollback Script
# ============================================================
# Rolls back all 5 workers to their previous versions using
# `wrangler rollback`. Use this when a bad deploy needs to be
# reverted immediately.
#
# Usage:
#   ./scripts/rollback.sh          # Rollback all workers
#   ./scripts/rollback.sh --dry    # Dry run (show what would happen)
#
# This does NOT rollback the frontend (CF Pages). To rollback
# the frontend, go to CF Pages dashboard and select a previous
# deployment, or redeploy from a known-good git tag.
#
# See RUNBOOK.md for full rollback procedures.
# ============================================================

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry" ]] && DRY_RUN=true

WORKERS=(
  nexus-storage
  nexus-ai
  nexus-variation
  nexus-workflow
  nexus-router
)

echo "============================================================"
echo "  NEXUS — Emergency Rollback"
echo "============================================================"
echo ""

if $DRY_RUN; then
  echo "  [DRY RUN] Would rollback the following workers:"
  for w in "${WORKERS[@]}"; do
    echo "    - $w"
  done
  echo ""
  echo "  Run without --dry to execute."
  exit 0
fi

echo "⚠️  Rolling back all workers to previous version..."
echo ""

failed=0
for w in "${WORKERS[@]}"; do
  echo -n "  Rolling back $w... "
  if npx wrangler rollback --name "$w" 2>/dev/null; then
    echo "✅"
  else
    echo "❌ (failed)"
    failed=$((failed + 1))
  fi
done

echo ""
if [ $failed -eq 0 ]; then
  echo "✅ All workers rolled back successfully!"
else
  echo "⚠️  $failed worker(s) failed to rollback. Check errors above."
fi
echo ""
echo "Next steps:"
echo "  1. Verify: curl https://nexus-router.<your-subdomain>.workers.dev/health"
echo "  2. Investigate the root cause before redeploying"
echo "============================================================"
