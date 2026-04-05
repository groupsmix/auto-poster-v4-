# NEXUS — One-Touch Recovery Guide

**You are NOT a developer. This guide is written for you.**

Your NEXUS system is designed to recover from any disaster with minimal effort.
Even if you lose your Cloudflare account AND your GitHub account, you can get everything back.

---

## How Your System Works (Automatic)

| What happens | How | You do anything? |
|---|---|---|
| Code changes deploy automatically | Push to `main` triggers deploy | No |
| Database is backed up weekly | Every Sunday at 02:00 UTC to R2 | No |
| All 5 workers redeploy in order | CI/CD pipeline handles it | No |
| Frontend redeploys automatically | Part of the deploy pipeline | No |
| API keys managed from dashboard | Settings page in your dashboard | Just the dashboard |

---

## Disaster Scenarios

### Scenario 1: "Something broke after a change"

**Go to:** GitHub repo → Actions → Run "Deploy" workflow manually

Or use the rollback:
1. Go to GitHub repo → Actions
2. Click "Deploy" in the sidebar
3. Click "Run workflow" dropdown
4. Click "Run workflow"

This redeploys everything fresh from the current code.

---

### Scenario 2: "I lost my Cloudflare account" (but still have GitHub)

**3 steps, ~10 minutes:**

1. **Create a new Cloudflare account** at [dash.cloudflare.com](https://dash.cloudflare.com)

2. **Set 2 secrets in GitHub:**
   - Go to your repo → **Settings** → **Secrets and variables** → **Actions**
   - Update these 2 secrets:
     - `CF_GLOBAL_API_KEY` → Your new Cloudflare Global API Key
       *(Find it: dash.cloudflare.com → Profile icon → API Tokens → Global API Key → View)*
     - `CF_EMAIL` → Your new Cloudflare account email

3. **Run One-Click Recovery:**
   - Go to your repo → **Actions** tab
   - Click **"One-Click Full Recovery"** in the sidebar
   - Click **"Run workflow"**
   - Type `RECOVER` in the confirmation box
   - Click **"Run workflow"**
   - Wait ~10 minutes. Done.

**Everything comes back:** all 5 workers, database (from latest backup), frontend dashboard, all settings.

---

### Scenario 3: "I lost BOTH GitHub AND Cloudflare" (worst case)

**5 steps, ~15 minutes:**

1. **Create a new GitHub account** (or use another one)

2. **Create a new repo** and push this code:
   ```
   git clone <your-backup-copy>
   cd auto-poster-v4-
   git remote set-url origin https://github.com/YOUR-NEW-ACCOUNT/auto-poster-v4-.git
   git push -u origin main
   ```

3. **Create a new Cloudflare account** at [dash.cloudflare.com](https://dash.cloudflare.com)

4. **Set 3 secrets in the new GitHub repo:**
   - Go to repo → **Settings** → **Secrets and variables** → **Actions**
   - Add these 3 secrets:
     - `CF_GLOBAL_API_KEY` → Cloudflare Global API Key
     - `CF_EMAIL` → Cloudflare account email
     - `GH_PAT` → GitHub Personal Access Token *(so recovery auto-sets all other secrets)*
       *(Create at: github.com → Settings → Developer Settings → Personal Access Tokens → Generate → select `repo` scope)*

5. **Run One-Click Recovery** (same as Scenario 2, step 3)

**The recovery workflow automatically:**
- Discovers your Cloudflare account
- Creates D1 database, KV namespace, R2 buckets
- Runs all database migrations
- Deploys all 5 workers
- Sets all worker secrets
- Restores data from the latest R2 backup (if one exists)
- Builds and deploys the dashboard
- Creates a scoped API token for future deploys
- Sets all GitHub secrets for automatic future deploys

---

## After Recovery

- **Dashboard URL:** Check the workflow output log for your new dashboard URL
- **Dashboard password:** Check the workflow output log (auto-generated if not provided)
- **Auto-deploy:** Push to `main` = automatic deploy (no action needed)
- **AI API keys:** Add them from the dashboard Settings page (no code needed)

---

## Your Dashboard = Your Control Panel

Everything you need is in the dashboard at your CF Pages URL:

- **Settings page:** Language, posting mode, CEO review, batch size, caching
- **API Key Management:** Add/remove AI provider keys (DeepSeek, OpenAI, etc.)
- **Products:** View and manage all generated products
- **Workflows:** Monitor running and completed workflows
- **Analytics:** Track performance and AI usage

**You never need to touch code.** The dashboard handles all configuration.

---

## Keep a Backup Copy

To protect against losing both accounts, keep a local copy of your code:

```bash
git clone https://github.com/YOUR-ACCOUNT/auto-poster-v4-.git ~/nexus-backup
```

Update it periodically:
```bash
cd ~/nexus-backup && git pull
```

Or just download the ZIP from GitHub → Code → Download ZIP and save it somewhere safe.

---

## Quick Reference

| Need to... | Do this |
|---|---|
| Add an AI API key | Dashboard → Settings → API Key Management |
| Change language/settings | Dashboard → Settings → General |
| Recover from Cloudflare loss | Set 2 GitHub secrets → Run recovery workflow |
| Recover from total loss | Push code to new repo → Set 3 secrets → Run recovery |
| Rollback a bad deploy | GitHub → Actions → Run deploy workflow |
| Check system health | Visit `https://nexus-router.<subdomain>.workers.dev/health` |
