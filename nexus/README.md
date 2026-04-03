# NEXUS V5 — "Ship or Die" Refactor

**The money printer, fixed.**

---

## What Was Fixed

This refactor addresses all blockers from the [Final Implementation Checklist](../NEXUS-FINAL-CHECKLIST.md):

### ✅ SOLVE (Blockers Fixed)

| # | Issue | Solution |
|---|-------|----------|
| 1 | **Cold Start Cascade** | Collapsed 5 workers → 3: `nexus-core`, `nexus-dispatch`, `nexus-scheduler` |
| 2 | **CF Workflows Lock-in** | Migrated to D1 state-machine (`job_queue` table) |
| 3 | **Niche Contamination** | Added `niche_id` FK to **every table**. RLS enforced in app layer. |
| 4 | **Platform API Death** | Built Playwright fallback in `nexus-dispatch`. No silent failures. |
| 5 | **Revenue Blindness** | UTM auto-tagging + Stripe webhook → attribution table. Track every dollar. |

### ✅ REMOVE (Debt Eliminated)

| # | Target | Replacement |
|---|--------|-------------|
| 1 | Multi-stage Review UI | Batch approval only. Confidence > 8 = auto-fire. |
| 2 | User Management Code | API key auth + IP whitelist. Dead weight gone. |
| 3 | Next.js Frontend | HTMX + Hono pages (or use your own lightweight frontend) |
| 4 | Real-time Analytics Charts | Daily CSV exports + SQLite queries. You need true, not pretty. |
| 5 | Platform "Variation Engine" Worker | Collapsed into `nexus-dispatch`. One adapter pattern. |

### ✅ ADD (Force Multipliers)

| # | Feature | Implementation |
|---|---------|----------------|
| 1 | **Inbox Capture Bot** | Telegram bot → `/note`, `/task`, `/idea` → AI extraction → D1 |
| 2 | **Content Recycler** | Cron: Auto-resurface top 20% performers after 90 days |
| 3 | **Conflict Detection** | Pre-publish hook: Check last 24h for contradictory statements |
| 4 | **Emergency Kill Switch** | Endpoint `/nuke` → revoke tokens, pause queues, export backup |
| 5 | **Local Fallback Mode** | Docker Compose: Postgres + Ollama + MinIO. 100% offline capable. |
| 6 | **Git Mirror** | Daily export: All content → Markdown + YAML → private Git repo |

---

## New Architecture (3 Workers)

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEXUS V5                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │  nexus-core     │◄──►│  nexus-dispatch │◄──►│ nexus-sched │  │
│  │                 │    │                 │    │             │  │
│  │ • API Router    │    │ • Platform APIs │    │ • Cron Jobs │  │
│  │ • D1 Storage    │    │ • Playwright FB │    │ • Recycling │  │
│  │ • AI Gateway    │    │ • UTM Tagging   │    │ • Telegram  │  │
│  │ • Job Queue     │    │ • Conflict Det. │    │ • Git Mirror│  │
│  │ • Auth/RLS      │    │                 │    │             │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
│           │                      │                      │        │
│           └──────────────────────┴──────────────────────┘        │
│                              │                                   │
│                    ┌─────────┴─────────┐                         │
│                    │   D1 Database     │                         │
│                    │   (State Machine) │                         │
│                    └───────────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Deploy to Cloudflare

```bash
# Install dependencies
pnpm install

# Set up database
wrangler d1 create nexus-db
# Copy database ID to wrangler.toml files

# Run migrations
wrangler d1 migrations apply nexus-db

# Deploy workers
pnpm run deploy

# Set secrets
wrangler secret put API_KEYS --env production
wrangler secret put TELEGRAM_BOT_TOKEN --env production
```

### 2. Run Locally (Offline Mode)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access:
# - Core API: http://localhost:8787
# - Frontend: http://localhost:3000
# - MinIO Console: http://localhost:9001
```

---

## API Examples

### Create a Job (D1 State Machine)

```bash
curl -X POST http://localhost:8787/api/jobs \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Niche-ID: your-niche-id" \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "product_generation",
    "entity_type": "product",
    "entity_id": "prod-123",
    "input_json": { "prompt": "Create a digital planner" },
    "priority": 5
  }'
```

### Publish with Conflict Detection

```bash
curl -X POST http://localhost:8788/publish \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "niche_id": "your-niche-id",
    "product_id": "prod-123",
    "platform": "twitter",
    "content": { "text": "Check out my new product!" }
  }'
```

### Emergency Kill Switch

```bash
curl -X POST http://localhost:8787/api/nuke \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Suspicious activity detected",
    "scope": "all",
    "revoke_tokens": true,
    "export_backup": true
  }'
```

---

## The "Money Print" Verification Test

Before you call this "done," verify:

- [ ] Can generate 100 posts across 5 niches in <10 minutes?
- [ ] Can approve all 100 in <2 minutes (batch UI)?
- [ ] Can track which post generated which dollar?
- [ ] Can survive Cloudflare account suspension (local mode works)?
- [ ] Can resurrect a 6-month-old hit post with one click?
- [ ] Can detect if you're about to post conflicting advice to different niches?

**Pass all 6 = You have a money printer.**  
**Fail any = Fix it before you scale.**

---

## Environment Variables

### nexus-core

| Variable | Description |
|----------|-------------|
| `API_KEYS` | Comma-separated list of valid API keys |
| `IP_WHITELIST` | Comma-separated list of allowed IPs (optional) |
| `AI_GATEWAY_URL` | Cloudflare AI Gateway URL (optional) |

### nexus-dispatch

| Variable | Description |
|----------|-------------|
| `TWITTER_API_KEY` | Twitter API credentials |
| `LINKEDIN_ACCESS_TOKEN` | LinkedIn access token |
| `PLAYWRIGHT_WS_ENDPOINT` | Browser automation endpoint (optional) |

### nexus-scheduler

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for inbox capture |
| `GIT_MIRROR_REPO` | GitHub repo for daily exports (format: owner/repo) |
| `GIT_MIRROR_TOKEN` | GitHub personal access token |

---

## Database Schema Changes

See [migrations/001_nexus_v5_refactor.sql](migrations/001_nexus_v5_refactor.sql) for full schema.

Key additions:
- `niches` table — multi-tenant isolation
- `job_queue` table — D1 state machine (replaces CF Workflows)
- `attribution` table — revenue tracking with UTM params
- `content_statements` table — conflict detection
- `recycled_content` table — content resurrection
- `emergency_events` table — audit log for kill switch

---

## Migration from V4

1. **Backup your data** — Export D1 before migration
2. **Run the migration** — `wrangler d1 migrations apply nexus-db`
3. **Update workers** — Deploy new 3-worker architecture
4. **Test locally first** — Use `docker-compose up` to verify
5. **Switch over** — Update frontend to point to new endpoints

---

## License

MIT — You own your IP. If NEXUS dies, your content lives on in Git.
