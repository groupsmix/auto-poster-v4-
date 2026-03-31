# NEXUS — Personal AI Business Engine

Automated product creation pipeline powered by AI, running entirely on Cloudflare's $5/month plan. Research, generate, review, and publish digital products across multiple platforms — all from one dashboard.

## Prerequisites

- **Node.js 22**
- **pnpm 9** (`npm install -g pnpm@9`)
- **Cloudflare account** (Workers Paid plan — $5/month)

## Quick Start

```bash
# 1. Clone
git clone https://github.com/groupsmix/auto-poster-v4-.git
cd auto-poster-v4-/nexus

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .dev.vars.example apps/workers/nexus-router/.dev.vars
cp .dev.vars.example apps/workers/nexus-ai/.dev.vars
cp .dev.vars.example apps/workers/nexus-storage/.dev.vars
# Edit each .dev.vars — see .dev.vars.example for which worker needs which vars

# 4. Run the frontend
cd apps/web
pnpm dev
```

## Architecture

NEXUS uses 5 specialized Cloudflare Workers connected via Service Bindings:

| Worker | Role |
|--------|------|
| `nexus-router` | Hono.js API router, auth, request validation |
| `nexus-ai` | AI Gateway, failover engine, model registry, response caching |
| `nexus-workflow` | CF Workflows management, step orchestration |
| `nexus-variation` | Platform variation engine, social adaptation |
| `nexus-storage` | R2, D1, KV, CF Images operations |

**Frontend:** Next.js on Cloudflare Pages (deployed via `deploy.yml`)

For a deep dive, see [NEXUS-ARCHITECTURE-V4.md](./NEXUS-ARCHITECTURE-V4.md).

## Feature Status

| Status | Features |
|--------|----------|
| **Core (Ready)** | Domains, Categories, Products, Workflows, Reviews, AI Manager, Analytics, History, Settings, Platforms, Social Channels, Prompts, Publishing |
| **Phase 2 (In Progress)** | Scheduler, Campaigns, Revenue Tracking, AI CEO Orchestrator, Daily Briefings |
| **Phase 3 (Planned)** | ROI Optimizer, Product Recycler, Localization, Chatbot, Project Builder |

## Scripts

All scripts run from the `nexus/` directory:

```bash
pnpm run build       # Build all packages
pnpm run dev         # Start dev servers
pnpm run typecheck   # TypeScript type checking
pnpm run lint        # ESLint
pnpm run test        # Vitest
```

## Deployment

Push to `main` triggers CI (`.github/workflows/ci.yml`). On success, `deploy.yml` deploys workers and frontend to Cloudflare.

## Adding a New AI Model

1. Add the model to the registry in `packages/shared/src/ai/registry.ts`
2. Set the API key as a Cloudflare secret on the `nexus-ai` worker
3. The model activates automatically — remove the key to deactivate

## Common Troubleshooting

- **API errors in frontend**: Ensure `NEXT_PUBLIC_API_URL` points to your `nexus-router` worker URL when deployed
- **AI calls failing**: Check that API keys are set on the correct worker (see `.dev.vars.example` for mapping)
- **Workflow stuck**: Check the workflow status in History page; CF Workflows persist state across tab closes
