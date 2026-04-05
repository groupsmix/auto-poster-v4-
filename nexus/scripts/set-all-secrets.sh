#!/usr/bin/env bash
# ============================================================
# NEXUS — Batch Secret Setter
# ============================================================
# Reads secrets from .env.secrets and sets them on the correct
# Cloudflare Workers via `wrangler secret put`.
#
# Usage:
#   ./scripts/set-all-secrets.sh                # Set all secrets from .env.secrets
#   ./scripts/set-all-secrets.sh --dry          # Dry run (show what would be set)
#   ./scripts/set-all-secrets.sh --file FILE    # Use a custom secrets file
#
# Prerequisites:
#   - npx wrangler login (already authenticated)
#   - .env.secrets file in the nexus/ directory (see .env.secrets.example)
#
# Required secrets checklist:
#   DASHBOARD_SECRET          → nexus-router (dashboard auth)
#   CF_ACCOUNT_ID             → nexus-storage, nexus-ai
#   AI_GATEWAY_ID             → nexus-ai
#   CUSTOM_DOMAIN_ORIGIN      → nexus-router (optional CORS origin)
#   TAVILY_API_KEY            → nexus-ai
#   EXA_API_KEY               → nexus-ai
#   SERPAPI_KEY                → nexus-ai
#   DEEPSEEK_API_KEY          → nexus-ai
#   DASHSCOPE_API_KEY         → nexus-ai
#   SILICONFLOW_API_KEY       → nexus-ai
#   FIREWORKS_API_KEY         → nexus-ai
#   GROQ_API_KEY              → nexus-ai
#   HF_TOKEN                  → nexus-ai
#   FAL_API_KEY               → nexus-ai
#   OPENROUTER_API_KEY        → nexus-ai
#   MOONSHOT_API_KEY          → nexus-ai
#   DATAFORSEO_KEY            → nexus-ai
#   ANTHROPIC_API_KEY         → nexus-ai
#   OPENAI_API_KEY            → nexus-ai
#   GOOGLE_API_KEY            → nexus-ai
#   PERPLEXITY_API_KEY        → nexus-ai
#   MIDJOURNEY_API_KEY        → nexus-ai
#   IDEOGRAM_API_KEY          → nexus-ai
#   ELEVENLABS_API_KEY        → nexus-ai
#   CARTESIA_API_KEY          → nexus-ai
#   SEGMIND_API_KEY           → nexus-ai
#   CLIPDROP_API_KEY          → nexus-ai
#   SUNO_API_KEY              → nexus-ai
#   UDIO_API_KEY              → nexus-ai
#   MINIMAX_API_KEY           → nexus-ai
#   PRINTFUL_API_KEY          → nexus-ai
#   PRINTIFY_API_KEY          → nexus-ai
#   PLACEIT_API_KEY           → nexus-ai
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NEXUS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DRY_RUN=false
SECRETS_FILE="$NEXUS_DIR/.env.secrets"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry) DRY_RUN=true; shift ;;
    --file) SECRETS_FILE="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "❌ Secrets file not found: $SECRETS_FILE"
  echo "   Copy .env.secrets.example to .env.secrets and fill in values."
  exit 1
fi

echo "============================================================"
echo "  NEXUS — Batch Secret Setter"
echo "============================================================"
echo ""

# Map of secret → target worker(s)
# Format: SECRET_NAME:worker1,worker2
declare -A SECRET_TARGETS=(
  ["DASHBOARD_SECRET"]="nexus-router"
  ["CF_ACCOUNT_ID"]="nexus-storage,nexus-ai"
  ["AI_GATEWAY_ID"]="nexus-ai"
  ["CUSTOM_DOMAIN_ORIGIN"]="nexus-router"
)

# All AI API keys go to nexus-ai
AI_KEYS=(
  TAVILY_API_KEY EXA_API_KEY SERPAPI_KEY DEEPSEEK_API_KEY DASHSCOPE_API_KEY
  SILICONFLOW_API_KEY FIREWORKS_API_KEY GROQ_API_KEY HF_TOKEN FAL_API_KEY
  OPENROUTER_API_KEY MOONSHOT_API_KEY DATAFORSEO_KEY ANTHROPIC_API_KEY
  OPENAI_API_KEY GOOGLE_API_KEY PERPLEXITY_API_KEY MIDJOURNEY_API_KEY
  IDEOGRAM_API_KEY ELEVENLABS_API_KEY CARTESIA_API_KEY SEGMIND_API_KEY
  CLIPDROP_API_KEY SUNO_API_KEY UDIO_API_KEY MINIMAX_API_KEY
  PRINTFUL_API_KEY PRINTIFY_API_KEY PLACEIT_API_KEY
)

for key in "${AI_KEYS[@]}"; do
  SECRET_TARGETS["$key"]="nexus-ai"
done

set_secret() {
  local name="$1"
  local value="$2"
  local worker="$3"

  if $DRY_RUN; then
    echo "  [DRY RUN] Would set $name on $worker"
  else
    echo "$value" | npx wrangler secret put "$name" --name "$worker" 2>/dev/null
    echo "  ✅ Set $name on $worker"
  fi
}

count=0
skipped=0

while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip comments and empty lines
  [[ -z "$line" || "$line" =~ ^# ]] && continue

  # Parse KEY=VALUE
  key="${line%%=*}"
  value="${line#*=}"

  # Remove surrounding quotes if present
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"

  if [[ -z "$value" ]]; then
    echo "  ⏭️  Skipping $key (empty value)"
    skipped=$((skipped + 1))
    continue
  fi

  targets="${SECRET_TARGETS[$key]:-}"
  if [[ -z "$targets" ]]; then
    echo "  ⚠️  Unknown secret: $key (skipping)"
    skipped=$((skipped + 1))
    continue
  fi

  IFS=',' read -ra workers <<< "$targets"
  for worker in "${workers[@]}"; do
    set_secret "$key" "$value" "$worker"
    count=$((count + 1))
  done
done < "$SECRETS_FILE"

echo ""
echo "============================================================"
echo "  Done! Set $count secrets ($skipped skipped)"
echo "============================================================"
