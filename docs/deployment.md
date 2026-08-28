# Production Deployment Guide

**Last updated:** 2026-08-28
**Repo:** https://github.com/dev-nayanray/zcrm

## Quick Start (Local Dev)

```bash
# 1. Install dependencies
bun install

# 2. Copy env and edit
cp .env.example .env
# Edit .env: set MONGODB_URI (MongoDB Atlas connection string) and AUTH_SECRET

# 3. Push the schema & seed
bun run db:push
bun run seed

# 4. Start the dev server
bun run dev
```

Open the app via the **Preview Panel** (the sandbox does not expose `localhost` directly).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Database | Prisma ORM + **MongoDB Atlas** (replica set required for `$transaction`) |
| Auth | Cookie-based HMAC-signed sessions + PBKDF2-SHA256 (600k iterations) |
| Accounting | Weighted Average Cost (WAC) — see [docs/accounting.md](./accounting.md) |
| Telegram | Bot API with webhook + RBAC via TelegramGroupMembership |
| WooCommerce | REST API (bidirectional) + HMAC-SHA256 webhook verification |
| Cron | Vercel Cron (every 5 min) for WooCommerce sync retry |

> **Note:** The previous README claimed "SQLite / Supabase PostgreSQL" — this was incorrect. The actual production database is **MongoDB Atlas**. The Float→Int money migration is planned (see [docs/money-migration.md](./money-migration.md)) but not yet switched on.

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string (replica set required) | `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/zcrm` |
| `AUTH_SECRET` | HMAC-SHA256 signing secret for session cookies (≥32 chars). Generate with `openssl rand -hex 32` | `a1b2c3...` |

### Optional (for integrations)

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Bearer token for Vercel Cron routes. Generate with `openssl rand -hex 32`. **If not set, the retry worker refuses to run** (refuses unauthenticated requests). |
| `PUBLIC_BASE_URL` | Public URL of the deployment (used by Telegram set-webhook). E.g. `https://zcrm.vercel.app` |

### WooCommerce config (stored in DB, not env)

WooCommerce credentials (URL, consumer key, consumer secret, webhook secret) are stored in the `Integration.config` JSON column, managed via the dashboard at `/app` → Integrations → WooCommerce. The consumer secret is NEVER returned to the client (the GET endpoint masks it).

### Telegram config (stored in DB, not env)

Telegram bot token is stored in the `TelegramBot` table, managed via the dashboard at `/app` → Integrations → Telegram.

## Vercel Deployment

### 1. Push to GitHub

The repo auto-deploys from `main`. Push:

```bash
git push origin main
```

### 2. Set environment variables in Vercel

In the Vercel dashboard → Settings → Environment Variables, add:
- `MONGODB_URI` (Production + Preview)
- `AUTH_SECRET` (Production + Preview)
- `CRON_SECRET` (Production only — generate with `openssl rand -hex 32`)

### 3. Vercel Cron (automatic)

The `vercel.json` at the repo root configures a cron job:

```json
{
  "crons": [
    {
      "path": "/api/cron/woocommerce-retry",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This runs every 5 minutes, calling `WooCommerceService.claimAndRetryFailed()`. Vercel sends `Authorization: Bearer <CRON_SECRET>` — the route verifies this against `process.env.CRON_SECRET`.

**Manual test:**
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.vercel.app/api/cron/woocommerce-retry
```

### 4. Database migration

After each deploy that touches `prisma/schema.prisma`:

```bash
# Run against production MongoDB
bunx prisma db push --accept-data-loss
```

**Pre-deploy checklist:**
- [ ] Verify no duplicate `externalId` values exist (sparse unique will fail on dupes)
- [ ] Back up the production MongoDB
- [ ] Test the migration on a staging DB first

## Quality Gates

```bash
bunx prisma generate    # Generate Prisma client
bun run lint            # ESLint
bunx tsc --noEmit       # TypeScript strict (0 errors as of Phase 4)
bun test                # Unit tests (240 pass, ~160ms)
bun run build           # Production build
```

## Demo Accounts (seeded)

| Role | Email | Password |
|---|---|---|
| SUPER_ADMIN | superadmin@zcrm.local | Admin@123 |
| ADMIN | admin@zcrm.local | Admin@123 |
| MANAGER | manager@zcrm.local | Manager@123 |
| SALES | sales@zcrm.local | Sales@123 |
| INVENTORY | inventory@zcrm.local | Stock@123 |
| ACCOUNTANT | accounts@zcrm.local | Accts@123 |

## Security Checklist

- [x] `.env*` gitignored (never committed)
- [x] Pre-commit hook scans for 8 secret patterns (MongoDB URI, AUTH_SECRET, Telegram bot token, WooCommerce cs_ keys, GitHub PATs, Stripe keys, generic password=/secret=/api_key=)
- [x] HMAC-SHA256 webhook verification (WooCommerce, Meta, WhatsApp, Telegram)
- [x] Constant-time signature comparison (prevents timing attacks)
- [x] PBKDF2-SHA256 password hashing (600k iterations, OWASP-compliant)
- [x] Account lockout after 5 failed logins (15-min)
- [x] Session revocation via `tokenVersion` field
- [x] Server-side RBAC on every API endpoint (84 permission strings, 6 roles)
- [x] Telegram RBAC tied to CRM roles (not username-based)
- [x] Audit log on every business-critical action (with `source` field: WEB/WOOCOMMERCE/TELEGRAM/API/SYSTEM)
- [x] Cron routes protected by CRON_SECRET bearer token

## Monitoring

- **Audit logs:** `/app` → Audit Logs (filterable by source, entity, action, user)
- **WooCommerce sync logs:** `/app` → Integrations → WooCommerce → Sync Logs
- **Webhook events:** `/app` → Integrations → Webhook Events (with retry button)
- **Telegram audit logs:** `/app` → Integrations → Telegram → Audit

## Troubleshooting

### Cron not running
1. Verify `CRON_SECRET` is set in Vercel env vars (Production)
2. Check Vercel dashboard → Functions → Cron for invocation history
3. Manually trigger: `curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/woocommerce-retry`

### WooCommerce webhook 401
The webhook route rejects unsigned POSTs. Verify the webhook secret in `Integration.config` matches the secret configured in WooCommerce → Settings → Advanced → Webhooks.

### MongoDB transaction errors
MongoDB Atlas requires a replica set for `$transaction`. The free tier M0 cluster supports replica sets — verify your connection string includes `retryWrites=true`.

### TypeScript errors after schema change
Run `bunx prisma generate` to regenerate the Prisma client after any `schema.prisma` change. Then `bunx tsc --noEmit`.
