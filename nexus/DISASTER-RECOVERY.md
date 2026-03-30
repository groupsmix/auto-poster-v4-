# NEXUS — Disaster Recovery Guide

> **Keep a copy of this repo on your local machine at all times.**
> As long as you have the code, you can rebuild everything.

---

## Quick Reference

| Scenario | Recovery Time | Steps |
|----------|--------------|-------|
| Deleted a single worker | 2 minutes | [Scenario 1](#scenario-1-deleted-a-single-worker) |
| Deleted D1 / KV / R2 | 5 minutes | [Scenario 2](#scenario-2-deleted-a-cloudflare-resource) |
| Lost Cloudflare account | 10 minutes | [Scenario 3](#scenario-3-lost-cloudflare-account) |
| Lost GitHub account | 10 minutes | [Scenario 4](#scenario-4-lost-github-account) |
| Lost BOTH accounts | 15 minutes | [Scenario 5](#scenario-5-lost-both-accounts) |

---

## Before Disaster Strikes (Do This Now)

### 1. Keep a local clone

```bash
git clone https://github.com/YOUR_USERNAME/auto-poster-v4-.git
```

This is your insurance. As long as you have this folder, you can rebuild everything.

### 2. Save your secrets somewhere safe

Write these down in a password manager (1Password, Bitwarden, etc.):

- **Cloudflare Account ID**
- **Cloudflare API Token** (or you can create a new one)
- **DASHBOARD_SECRET** (the password you chose)
- **DEEPSEEK_API_KEY** (or whatever AI keys you use)

### 3. Set up GitHub Secrets (for one-click recovery)

Go to your repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret Name | Value | Where to get it |
|-------------|-------|-----------------|
| `CLOUDFLARE_ACCOUNT_ID` | Your CF account ID | [CF Dashboard](https://dash.cloudflare.com) → right sidebar |
| `CLOUDFLARE_API_TOKEN` | API token | [Create here](https://dash.cloudflare.com/profile/api-tokens) |
| `DASHBOARD_SECRET` | Any password you pick | You choose this |
| `DEEPSEEK_API_KEY` | Your DeepSeek key | [Get here](https://platform.deepseek.com) |

---

## Scenario 1: Deleted a Single Worker

**What happened:** You accidentally deleted one of the 5 workers from Cloudflare.

### Option A: One command (terminal)

```bash
cd auto-poster-v4-/nexus
./deploy.sh storage    # or: ai, variation, workflow, router
```

### Option B: GitHub Actions

1. Go to repo → Actions → **Deploy**
2. Click "Run workflow"

This re-deploys everything.

---

## Scenario 2: Deleted a Cloudflare Resource

**What happened:** You deleted the D1 database, KV namespace, or R2 bucket.

### Option A: One click (GitHub)

1. Go to repo → **Actions** → **Disaster Recovery**
2. Click **"Run workflow"**
3. Type `RECOVER` → click the green button
4. Wait ~5 minutes

The workflow will detect the missing resource, recreate it, and redeploy everything.

### Option B: Terminal

```bash
cd auto-poster-v4-/nexus
npx wrangler login       # if not already logged in
./bootstrap.sh
```

> **Note:** If you deleted D1, your data (products, workflows, reviews) is lost.
> The schema and seed data (domains, categories, platforms, prompts) will be restored.

---

## Scenario 3: Lost Cloudflare Account

**What happened:** You lost access to your Cloudflare account or want to start fresh on a new one.

### Step 1: Create a new Cloudflare account

1. Go to [cloudflare.com](https://www.cloudflare.com) → Sign up
2. Choose the $5/month Workers Paid plan
3. Note your **Account ID** (Dashboard → right sidebar)

### Step 2: Create an API token

1. Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use "Custom Token" with these permissions:
   - Account → Workers Scripts → Edit
   - Account → Workers KV Storage → Edit
   - Account → D1 → Edit
   - Account → Cloudflare Pages → Edit
   - Account → Workers R2 Storage → Edit
4. Copy the token

### Step 3: Update GitHub Secrets

1. Go to your repo → Settings → Secrets → Actions
2. Update `CLOUDFLARE_ACCOUNT_ID` with the new account ID
3. Update `CLOUDFLARE_API_TOKEN` with the new token

### Step 4: One-click recovery

1. Go to repo → **Actions** → **Disaster Recovery**
2. Click **"Run workflow"**
3. Type `RECOVER` → click
4. Wait ~5 minutes

Everything is rebuilt on the new Cloudflare account.

### Alternative: Terminal recovery

```bash
cd auto-poster-v4-/nexus
npx wrangler login       # login to the NEW CF account
./bootstrap.sh
```

---

## Scenario 4: Lost GitHub Account

**What happened:** You lost access to your GitHub account.

### Step 1: Do you have a local clone?

**Yes → skip to Step 3**

**No →** If you don't have the code anywhere:
- Check if you forked it to another account
- Check if someone else has a fork
- If the repo was public, it might be cached on archive.org

### Step 2: Create a new GitHub account

1. Go to [github.com](https://github.com) → Sign up

### Step 3: Push code to new account

```bash
# Create a new repo on GitHub (click "New repository" on github.com)
# Then push your local code:

cd auto-poster-v4-
git remote set-url origin https://github.com/NEW_USERNAME/auto-poster-v4-.git
git push -u origin main
```

### Step 4: Add GitHub Secrets

1. Go to the new repo → Settings → Secrets → Actions
2. Add `CLOUDFLARE_ACCOUNT_ID`
3. Add `CLOUDFLARE_API_TOKEN`
4. Add `DASHBOARD_SECRET` (optional)
5. Add `DEEPSEEK_API_KEY` (optional)

### Step 5: Verify

The GitHub Actions workflows are already in the code, so they'll appear automatically:
- **CI** will run on next push
- **Deploy** will run on push to main
- **Disaster Recovery** button will be available in Actions tab

---

## Scenario 5: Lost BOTH Accounts

**What happened:** You lost both your GitHub and Cloudflare accounts. Worst case.

### What you need

- A copy of the code (local clone, USB drive, zip file — anything)

### Step 1: Create new Cloudflare account

1. Go to [cloudflare.com](https://www.cloudflare.com) → Sign up
2. Choose $5/month Workers Paid plan
3. Note your **Account ID**
4. Create an **API Token** ([instructions above](#step-2-create-an-api-token))

### Step 2: Create new GitHub account + repo

1. Go to [github.com](https://github.com) → Sign up
2. Create a new repository called `auto-poster-v4-`

### Step 3: Push your code

```bash
cd auto-poster-v4-
git remote set-url origin https://github.com/NEW_USERNAME/auto-poster-v4-.git
git push -u origin main
```

### Step 4: Add GitHub Secrets

Go to new repo → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `CLOUDFLARE_ACCOUNT_ID` | From new CF account |
| `CLOUDFLARE_API_TOKEN` | From new CF account |
| `DASHBOARD_SECRET` | Any password you choose |
| `DEEPSEEK_API_KEY` | Your AI key |

### Step 5: One-click recovery

1. Go to repo → **Actions** → **Disaster Recovery**
2. Click **"Run workflow"**
3. Type `RECOVER` → click
4. Wait ~5 minutes

### Step 6: Verify everything works

```bash
# Check workers health
curl https://nexus-router.YOUR_SUBDOMAIN.workers.dev/health

# Visit your dashboard
# Go to CF Dashboard → Pages → nexus-dashboard → find the URL
```

**Done.** Everything is rebuilt from scratch on brand new accounts.

---

## What Gets Restored vs. What's Lost

| Component | Restored? | Details |
|-----------|-----------|---------|
| All 5 workers (code + config) | **Yes** | Redeployed from code |
| Frontend dashboard | **Yes** | Redeployed from code |
| Database schema (tables, indexes) | **Yes** | Rebuilt from migrations |
| Domains + categories (10 domains, 70+ categories) | **Yes** | Rebuilt from seed data |
| Platforms (Etsy, Gumroad, Shopify, etc.) | **Yes** | Rebuilt from seed data |
| Social channels (Instagram, TikTok, etc.) | **Yes** | Rebuilt from seed data |
| Prompt templates (45+ prompts) | **Yes** | Rebuilt from prompt files |
| AI model registry (30+ models) | **Yes** | Hardcoded in worker code |
| Your products (content you created) | **No** | Was in D1 database |
| Workflow runs + history | **No** | Was in D1 database |
| Uploaded files (images, PDFs) | **No** | Was in R2 bucket |
| AI response cache | **No** | Was in KV namespace |
| Reviews + revision history | **No** | Was in D1 database |

---

## Recovery Method Comparison

| Method | Requires | Best for |
|--------|----------|----------|
| **GitHub Actions (one-click)** | GitHub + internet | Easiest — just click a button |
| **bootstrap.sh (terminal)** | Terminal + wrangler login | When GitHub Actions isn't available |
| **deploy.sh (manual)** | Terminal + existing CF resources | Quick redeploy (resources already exist) |

---

## Emergency Contacts & Links

| Resource | URL |
|----------|-----|
| Cloudflare Dashboard | https://dash.cloudflare.com |
| Cloudflare API Tokens | https://dash.cloudflare.com/profile/api-tokens |
| DeepSeek API Keys | https://platform.deepseek.com |
| GitHub New Repo | https://github.com/new |
| Wrangler Docs | https://developers.cloudflare.com/workers/wrangler |

---

## TL;DR

1. **Keep a local clone** of this repo
2. If anything breaks: GitHub → Actions → Disaster Recovery → Run workflow → type `RECOVER`
3. If GitHub is gone too: new GitHub + new Cloudflare + push code + add 2 secrets + click recover
