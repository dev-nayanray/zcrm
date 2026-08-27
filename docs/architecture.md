# Architecture

## High-level flow

```
WordPress + WooCommerce
   │  REST API + Webhooks (HMAC-signed)
   ▼
CRM API  (Next.js App Router, /api/v1/*)
   │  Route handlers = thin: auth → permission → validate → call service → respond
   ▼
Business Services (transaction-safe, owns the accounting & inventory logic)
   │  OrderService, PaymentService, InventoryService, PurchaseService,
   │  ReturnService, RefundService, AccountingService, AuditService,
   │  WooCommerceService, NotificationService
   ▼
Prisma ORM → Database (SQLite sandbox / Supabase PostgreSQL production)
   ▲
CRM Dashboard — single-page app on `/` with a Zustand client-side router
```

## Design rules (enforced in code)

1. **UI never contains critical business logic.** Components render data; all accounting, inventory and money operations live in services.
2. **Frontend-supplied financial values are never trusted.** Order totals, COGS, payment status are recomputed server-side from DB state.
3. **Inventory has one authoritative source: the Stock Movement ledger.** `Inventory.quantity` is only ever changed inside a transaction that also writes a `StockMovement` row with `previousQuantity / quantityChange / newQuantity`.
4. **Money uses Prisma `Decimal`** — no floating-point arithmetic anywhere.
5. **Order items store historical snapshots** of `productName`, `sku`, `unitPrice`, `unitCost`. Changing a product's price later cannot alter historical order profitability.
6. **All financial transactions use `db.$transaction`** with a 20s timeout. Audit logs are written inside the same transaction (passing `tx`) to avoid SQLite write-lock deadlocks.
7. **RBAC is enforced on every endpoint** — hiding buttons in the UI is not security.
8. **Audit logs are immutable** — no update/delete API is exposed.

## Request lifecycle

```
HTTP request
  → requirePermission("orders:create")        // 401 if no session, 403 if no permission
  → readJsonBody + Zod schema                 // 422 if invalid
  → OrderService.create(input)                // runs inside db.$transaction
      → snapshots product data from DB
      → recalculates subtotal/discount/total
      → creates order + items + status history
      → applies SALE stock movements (same tx)
      → optional payment (same tx)
      → audit log (same tx)
  → ok(order) | badRequest(message)          // standard envelope
```

## File layout

```
src/
  app/
    api/v1/         # Route handlers (thin controllers)
    page.tsx        # The single user-visible route — boots auth, renders shell
    layout.tsx      # Root layout, fonts, Sonner toaster
  components/
    ui/             # shadcn/ui primitives
    crm/            # Shell, sidebar, topbar, login, and 24 module views
  lib/
    auth.ts         # cookie session + RBAC helpers
    api.ts          # response envelope helpers
    api-client.ts   # frontend fetch wrapper
    constants.ts    # enums, permissions, role→permission map
    decimal.ts      # Decimal/money helpers (no floats)
    guards.ts       # requireAuth / requirePermission
    query.ts        # pagination parsing + CSV export
    date-range.ts   # preset/range resolution
    store.ts        # Zustand client-side router
    validation.ts   # Zod schemas
    db.ts           # Prisma client singleton
    services/       # business logic (the single source of truth)
prisma/
  schema.prisma     # full schema (29 models)
  seed.ts           # realistic Bangladesh business data
docs/               # architecture, database, api, auth, rbac, inventory, accounting, woocommerce, deployment
```
