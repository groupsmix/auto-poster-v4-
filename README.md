# Nexus Product Studio

A personal end-to-end dashboard for discovering opportunities and building digital products or simple sites in one workflow.

## What this version does

This replaces the mixed V4/V5 direction with one clear app:

- **Opportunity Engine**: rank ideas by demand, monetization, authority value, and production speed
- **Digital Product Pipeline**: brief -> outline -> content -> brand assets -> sales assets -> export package
- **Site Pipeline**: brief -> page strategy -> copy -> asset prompts -> export package
- **Project Library**: every run is stored as a project with status, artifacts, and exportable files
- **ZIP Export**: each completed project can be downloaded as a structured ZIP

## Stack

- Next.js 15 App Router
- TypeScript
- Prisma + SQLite
- OpenAI-compatible provider abstraction with deterministic fallback
- Server-side workflow engine

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm prisma db push
pnpm prisma db seed
pnpm dev
```

Then open `http://localhost:3000`.

## How the AI layer works

This code is built to work even before you wire in a real model.

- If `OPENAI_API_KEY` is set, the app calls an OpenAI-compatible endpoint.
- If no key is configured, the app falls back to a deterministic local generator so the full workflow still runs end to end.

That means you can push and run the full system now, then upgrade the content quality later by adding your preferred model.

## Main product flow

1. Discover an opportunity
2. Create a project
3. Run one-click workflow
4. Review generated assets
5. Export ZIP package

## Main folders

- `app/` UI and API routes
- `components/` dashboard and project UI
- `lib/` workflow engine, AI layer, export builder, Prisma helpers
- `prisma/` schema and seed

## Notes

This code is designed for **personal use first**:
- one operator
- one dashboard
- one-click runs
- premium quality target
- digital product and simple site outputs

## Suggested next steps after pushing

- Replace the fallback generator prompts with your preferred model/provider
- Add image generation/storage provider
- Add PDF rendering service
- Add deploy target for generated sites
- Add marketplace publishing once packaging is stable
