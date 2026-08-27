# Deployment

## Target architecture

```
WordPress + WooCommerce  (existing store)
        │  REST + Webhooks
        ▼
CRM (Frontend + API)     → Vercel Free Tier
        │
        ▼
Database                → Supabase Free Tier (PostgreSQL)
```

The CRM is deployed as a single Next.js app (frontend + API routes). The database is external.

---

## 1. Database — Supabase

1. Create a project at https://supabase.com (Free tier).
2. In `prisma/schema.prisma`, change the datasource to PostgreSQL:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```

3. In Supabase → Project Settings → Database → Connection string, copy:
   - **Transaction pooler** URL → `DATABASE_URL`
   - **Session pooler** URL → `DIRECT_URL` (for migrations)

4. Set the env vars (locally and in Vercel):

   ```
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"
   DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   ```

5. Run migrations:

   ```bash
   bunx prisma migrate deploy
   bunx prisma db seed   # or: bun run seed
   ```

> The schema in this repo is already PostgreSQL-compatible (Decimal fields, indexes, unique constraints). The sandbox runs on SQLite only because the bundled Prisma client is the SQLite variant.

## 2. Frontend + API — Vercel

1. Push the repo to GitHub.
2. In Vercel → New Project → import the repo.
3. Framework preset: **Next.js**. Build command `next build`, output standalone (already configured in `next.config.ts`).
4. Environment variables (Vercel → Settings → Environment Variables):

   ```
   DATABASE_URL              # from Supabase (transaction pooler)
   DIRECT_URL                # from Supabase (session pooler)
   AUTH_SECRET               # openssl rand -hex 32
   NEXT_PUBLIC_SUPABASE_URL  # https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY # server-only
   WOOCOMMERCE_URL
   WOOCOMMERCE_CONSUMER_KEY
   WOOCOMMERCE_CONSUMER_SECRET
   WOOCOMMERCE_WEBHOOK_SECRET
   ```

5. Deploy. Vercel gives you `https://<project>.vercel.app`.

## 3. WooCommerce webhook configuration

In WordPress admin → WooCommerce → Settings → API → Webhooks → Add webhook:

| Field | Value |
|---|---|
| Name | Z-CRM |
| Delivery URL | `https://<your-vercel-domain>/api/v1/integrations/woocommerce/webhook` |
| Secret | the same value as `WOOCOMMERCE_WEBHOOK_SECRET` |
| Topic | `Order created`, `Order updated`, `Product created`, `Product updated`, `Customer created`, `Customer updated` (one webhook per topic, or use `Any`) |
| API version | latest |

Save. WooCommerce will deliver a `webhook.created` ping; check the Sync Logs page in the CRM.

## 4. First sync

1. Log in as ADMIN.
2. Integrations → WooCommerce → fill the URL / Consumer Key / Consumer Secret / Webhook Secret → Save.
3. Click **Test Connection** → should say "Connected".
4. Click **Sync Products** then **Sync Orders** to backfill existing data.

## 5. Local development

```bash
bun install
cp .env.example .env          # uses SQLite by default in this sandbox
bun run db:push
bun run seed
bun run dev                  # http://localhost:3000 (preview via the sandbox panel)
```

## Quality gates before release

```bash
bun run lint                 # ESLint
npx tsc --noEmit             # TypeScript strict
bun run dev                  # then verify the golden path with a browser
```
