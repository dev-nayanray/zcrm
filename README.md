# Z-CRM — Custom Business CRM + Order Management + Inventory + Accounting + P&L

A centralized business management system that unifies **website orders**, **WooCommerce orders** and **offline/manual orders** into a single dashboard with automatic sales, payment, expense, stock, COGS and profit/loss calculation.

Replaces manual notebook/Excel bookkeeping for daily operations.

---

## Features

- **Dashboard** — today/month KPIs, sales/expense/profit trends, sales by channel, top products, low/out-of-stock alerts. Uses the same `AccountingService` as all reports (no duplicated logic).
- **Customer CRM** — CRUD, search, order/payment history, lifetime value, outstanding balance. Duplicate prevention by phone.
- **Products** — catalog with SKU/slug uniqueness, backend-validated pricing, sales & purchase history.
- **Categories** — nested categories with circular-parent prevention.
- **Suppliers** — vendor profile, purchase history, outstanding payables.
- **Orders** — website/WooCommerce/offline orders with `sourceChannel`, status workflow, payment status, profit per order.
- **Order Items** — **historical snapshots** of `productName`, `sku`, `unitPrice`, `unitCost` so changing a product's price later never affects historical profitability (COGS accuracy).
- **Offline Order Creation** — fast screen: search customer → search product → quantity/discount → shipping/other cost → payment. Totals **always recalculated & validated on the server**.
- **Payments** — Cash / bKash / Nagad / Bank / Card / Other. Full/partial/multiple payments. **Payment status is always recomputed from actual payment records** — never trusted from the frontend. Overpayment prevention.
- **Inventory** — **ledger-based** (Stock Movements). Every change is a movement with `previousQuantity` / `quantityChange` / `newQuantity`. Never silent. Negative-stock prevention (configurable). Concurrency-safe transactions.
- **Purchases** — receiving a purchase increases stock via `PURCHASE` movements; updates product cost to latest.
- **Returns & Refunds** — full/partial/exchange. GOOD returns increase sellable stock; DAMAGED returns move to the damaged bucket. Refunds reduce paid amounts & recompute status.
- **Expenses** — 9 categories, included in P&L.
- **Profit & Loss** — Revenue − COGS − Order Costs − Operating Expenses − Refunds = Net Profit. Centralized in `AccountingService`.
- **Reports** — Sales, Payments, Expenses, Inventory, Products, Customers — all with date filtering (today/yesterday/this week/last week/this month/last month/this year/custom).
- **Audit Logs** — immutable record of every business-critical action (login, order, payment, refund, stock, purchase, user/permission/settings changes).
- **WooCommerce Integration** — product/customer/order sync, **idempotent webhook** receiver with HMAC-SHA256 signature verification, sync log with retry metadata. Consumer secret never exposed to client.
- **Notifications** — in-app alerts (low stock, failed sync, pending payment). Designed for future email/WhatsApp delivery.
- **RBAC** — 6 roles (SUPER_ADMIN, ADMIN, MANAGER, SALES, INVENTORY, ACCOUNTANT) with granular permissions enforced **server-side on every endpoint**.
- **Exports** — CSV for orders, customers, products, inventory, purchases, expenses, payments, P&L.
- **Dark mode** & fully **responsive** mobile UI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) + Lucide |
| State | Zustand (client), TanStack Query patterns via `fetch` wrapper |
| Charts | Recharts |
| Forms | React Hook Form patterns + Zod validation |
| Database | Prisma ORM (SQLite in sandbox; Supabase PostgreSQL in production target) |
| Auth | Cookie-based HMAC-signed sessions (mirrors Supabase Auth contract) |
| Accounting | Prisma `Decimal` (no floating-point money) |

> **Note on the sandbox:** this repository runs on SQLite (the sandbox only ships the SQLite Prisma client). The schema and all business logic are PostgreSQL-compatible — to deploy on Supabase, change the `datasource` provider to `postgresql` and run `prisma migrate deploy`. The auth layer is isolated in `src/lib/auth.ts` so you can swap the cookie-session implementation for Supabase Auth without touching the rest of the app.

---

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Copy env and edit if needed
cp .env.example .env

# 3. Push the schema & seed the database
bun run db:push
bun run seed

# 4. Start the dev server
bun run dev
```

Open the app via the **Preview Panel** (the sandbox does not expose `localhost` directly).

### Demo accounts (seeded)

| Role | Email | Password |
|---|---|---|
| SUPER_ADMIN | superadmin@zcrm.local | Admin@123 |
| ADMIN | admin@zcrm.local | Admin@123 |
| MANAGER | manager@zcrm.local | Manager@123 |
| SALES | sales@zcrm.local | Sales@123 |
| INVENTORY | inventory@zcrm.local | Stock@123 |
| ACCOUNTANT | accounts@zcrm.local | Accts@123 |

---

## Architecture

```
WordPress / WooCommerce
       ↓ WooCommerce REST + Webhooks
CRM API (Next.js Route Handlers, /api/v1/*)
       ↓ Business Services (OrderService, PaymentService, InventoryService,
       ↓   PurchaseService, ReturnService, AccountingService, AuditService,
       ↓   WooCommerceService, NotificationService)
Prisma ORM → Database (SQLite / Supabase PostgreSQL)
       ↑
CRM Dashboard (single-page app on / with Zustand client-side router)
```

- **UI never contains critical accounting or inventory logic.** API routes call business services; services own the transactions.
- **Frontend-supplied financial values are never trusted.** Order totals, COGS, payment status are all recomputed server-side from the database.
- **Inventory has one authoritative source: the Stock Movement ledger.**

### Single authoritative accounting model (used everywhere)

```
Revenue         = Σ order.total (excluding CANCELLED)
Discounts       = Σ order.discount
Shipping/Other  = Σ order.shippingCost + order.otherCost
COGS            = Σ orderItem.unitCost × quantity   (historical snapshot)
Refunds         = Σ refund.amount
Gross Profit    = Revenue − Refunds − COGS
Operating Exp.  = Σ expense.amount
Net Profit      = Gross Profit − Operating Expenses
```

Implemented once in `src/lib/services/accounting.ts` and consumed by the Dashboard, P&L report and every financial report.

---

## API

All endpoints are under `/api/v1` and require authentication + permission (except `auth/login`). Standard envelope:

```jsonc
// success
{ "success": true, "data": { … } }
// error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [...] } }
```

Major groups: `auth`, `dashboard`, `customers`, `products`, `categories`, `suppliers`, `channels`, `orders` (+ `:id` + `:id/payments`), `purchases`, `inventory` (+ `:productId`), `payments`, `expenses`, `expense-categories`, `returns`, `refunds`, `reports/{profit-loss,sales,payments,expenses,inventory,products,customers}`, `audit`, `notifications`, `users`, `roles`, `settings`, `integrations/woocommerce` (+ `/sync` + `/webhook`), `exports/[type]`.

See `docs/api.md` for the full list.

---

## Quality Gates

```bash
bun run lint      # ESLint — PASS
npx tsc --noEmit  # TypeScript strict — PASS
bun run dev       # Verified end-to-end via headless browser
```

---

## Documentation

- `docs/architecture.md` — system architecture & data flow
- `docs/database.md` — tables & relationships
- `docs/api.md` — REST endpoints
- `docs/authentication.md` — session auth & RBAC
- `docs/rbac.md` — roles & permissions matrix
- `docs/inventory.md` — the stock movement ledger
- `docs/accounting.md` — Revenue, COGS, P&L calculation
- `docs/woocommerce.md` — sync & idempotent webhooks
- `docs/deployment.md` — Vercel + Supabase + WooCommerce webhook setup
