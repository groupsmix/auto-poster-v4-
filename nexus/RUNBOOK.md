# NEXUS Operations Runbook

## Rollback Strategy

Every successful deploy via GitHub Actions is tagged with `deploy-YYYYMMDD-HHMMSS`.

### Emergency Rollback (Single Worker)

Use `wrangler rollback` to revert a worker to its previous version:

```bash
cd nexus
npx wrangler rollback --name nexus-router
npx wrangler rollback --name nexus-storage
npx wrangler rollback --name nexus-ai
npx wrangler rollback --name nexus-workflow
npx wrangler rollback --name nexus-variation
```

### Full Rollback (All Workers)

Run the rollback script to revert all 5 workers at once:

```bash
cd nexus
./scripts/rollback.sh
```

Or dry-run first:

```bash
./scripts/rollback.sh --dry
```

### Rollback to a Specific Git Tag

If you need to redeploy from a known-good tag:

```bash
git checkout deploy-20260115-143022
cd nexus
pnpm install --frozen-lockfile
pnpm run build
./deploy.sh --workers
```

### When to Use Each Tool

| Scenario | Tool | Command |
|---|---|---|
| Bad deploy, revert immediately | `wrangler rollback` | `npx wrangler rollback --name <worker>` |
| Revert all workers at once | `rollback.sh` | `./scripts/rollback.sh` |
| Re-deploy a single worker | `deploy.sh` | `./deploy.sh <worker-name>` |
| Full deploy (CI/CD) | GitHub Actions | Push to `main` branch |
| Full from-scratch rebuild | `bootstrap.sh` | `./bootstrap.sh` |
| Disaster recovery | GitHub Actions | Run "Disaster Recovery" workflow |

## Monitoring & Alerts

### Cloudflare Error Notifications

Set up error notifications to be alerted when workers fail:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Notifications** → **Create**
2. Select **"Workers Scripts Error Rate Above Threshold"**
3. Set threshold (e.g., 5 errors per minute)
4. Add your email as the notification target
5. Repeat for each critical worker (nexus-router, nexus-storage, nexus-ai)

### External Uptime Monitoring (Optional)

Set up [UptimeRobot](https://uptimerobot.com) (free tier) or similar:

- Monitor: `GET https://nexus-router.<your-subdomain>.workers.dev/health`
- Check interval: 5 minutes
- Alert via: email, Slack, or webhook

## Health Check Endpoint

All workers expose a `/health` endpoint. The router aggregates them:

```bash
curl https://nexus-router.<your-subdomain>.workers.dev/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": { "storage": "ok", "ai": "ok", "workflow": "ok", "variation": "ok" }
  }
}
```

## Secret Management

### Viewing Required Secrets

See `nexus/.env.secrets.example` for the full list of secret names.

### Setting Secrets in Bulk

```bash
cp nexus/.env.secrets.example nexus/.env.secrets
# Edit .env.secrets with your values
./nexus/scripts/set-all-secrets.sh
```

### Setting Secrets via GitHub Actions

Add secrets in: **Repo Settings** → **Secrets and variables** → **Actions**

Required:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Optional (AI keys, dashboard auth, etc.):
- `NEXUS_API_URL` — Frontend API endpoint
- `DASHBOARD_SECRET` — Dashboard authentication
- `DEEPSEEK_API_KEY` — DeepSeek AI (free tier available)
- See `.env.secrets.example` for the full list
