# Migration Notes

This codebase is intentionally built as a clean replacement for the mixed V4/V5 architecture.

## Recommended merge strategy into your repo

1. Create a new branch in your repo.
2. Add this project under a new root such as `studio/` or replace the current `nexus/` app path.
3. Keep old V4 workers as read-only reference.
4. Make this project the only active dashboard app.
5. Add your real model keys in `.env`.
6. Upgrade the fallback generators step by step.

## Why this direction

- one personal dashboard
- one end-to-end workflow
- one export package
- no split between old workers and new workers
- easier to reason about than the existing transition state
