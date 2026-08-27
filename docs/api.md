# API Reference

Base path: `/api/v1`. All endpoints require a valid session cookie (except `auth/login`). Every write endpoint also requires the relevant permission (see `docs/rbac.md`). Standard envelope:

```jsonc
{ "success": true, "data": {} }
{ "success": false, "error": { "code": "FORBIDDEN", "message": "…" } }
```

## Auth

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/auth/login` | — | `{ email, password }` → sets session cookie |
| POST | `/auth/logout` | — | destroys session |
| GET  | `/auth/me`   | — | returns `{ user, permissions }` |

## Dashboard

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/dashboard` | `dashboard:read` | `?preset=today|yesterday|this_week|this_month|last_month|this_year` or `?from=&to=`. Returns today KPIs, range P&L, monthly snapshot, order/payment status counts, low/out-of-stock, trend, sales-by-channel, top products, stock value |

## Customers

| Method | Path | Permission |
|---|---|---|
| GET | `/customers` | `customers:read` |
| POST | `/customers` | `customers:create` |
| GET | `/customers/:id` | `customers:read` |
| PUT | `/customers/:id` | `customers:update` |
| DELETE | `/customers/:id` | `customers:delete` (blocked if has orders) |

## Products & Categories

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/products` | read/create |
| GET/PUT/DELETE | `/products/:id` | read/update/delete (soft delete) |
| GET/POST | `/categories` (?all=true for full tree) | read/create |
| GET/PUT/DELETE | `/categories/:id` | read/update/delete (blocked if has products/children) |

## Suppliers & Channels

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/suppliers` | read/create |
| GET/PUT/DELETE | `/suppliers/:id` | read/update/delete |
| GET/POST | `/channels` | read / `settings:update` |

## Orders

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/orders` | `orders:read` | filters: `search,status,paymentStatus,channelId,customerId,from,to` |
| POST | `/orders` | `orders:create` | body: `{ customerId, channelId?, status?, discount, shippingCost, otherCost, notes, items:[{productId,quantity,discount}], payment?:{amount,method,transactionReference} }`. **Totals recalculated server-side** |
| GET | `/orders/:id` | `orders:read` | includes items, payments, refunds, returns, statusHistory, profit breakdown |
| PATCH | `/orders/:id` | `orders:update` | `{ status, note }`. CANCELLED restores stock |
| DELETE | `/orders/:id` | `orders:delete` | only unpaid PENDING |
| GET/POST | `/orders/:id/payments` | `payments:read` / `payments:create` | overpayment prevented |

## Purchases

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/purchases` | read/create (POST receives stock) |
| GET | `/purchases/:id` | read |
| PATCH | `/purchases/:id?action=receive` | `purchases:update` (increases stock) |

## Inventory

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/inventory` | `inventory:read` | `?status=low|out` |
| POST | `/inventory` | `inventory:adjust` | `{ productId, type:ADJUSTMENT|DAMAGE|TRANSFER_IN|TRANSFER_OUT, quantityChange, reason }` |
| GET | `/inventory/:productId` | `inventory:read` | stock movements (ledger) |

## Payments, Expenses, Returns, Refunds

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/payments` | read / `refunds:create` (POST = refund, body needs `orderId`) |
| GET/POST | `/expenses` | read / create |
| PUT/DELETE | `/expenses/:id` | update / delete |
| GET | `/expense-categories` | read |
| GET/POST | `/returns` | read / create (stock adjusted, optional refund) |
| GET | `/returns/:id` | read |
| GET | `/refunds` | read |

## Reports (all require `reports:read`, support `?preset=` or `?from=&to=`)

| Path | Returns |
|---|---|
| `/reports/profit-loss` | full P&L (revenue, COGS, gross profit, operating expenses, net profit, refunds, paid, outstanding) |
| `/reports/sales` | order count, gross/net sales, avg order value, by channel, top products |
| `/reports/payments` | total paid, by method, unpaid orders, outstanding |
| `/reports/expenses` | total, by category, by date, list |
| `/reports/inventory` | stock value, low/out, movements |
| `/reports/products` | sales/qty/revenue/COGS/profit per product |
| `/reports/customers` | orders/spending/outstanding per customer |

## Users & Roles

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/users` | read/create |
| PUT/DELETE | `/users/:id` | update/delete (deactivate; cannot delete self) |
| GET/POST | `/roles` | read/create |
| PATCH | `/roles/:id` | `roles:update` (system roles locked) |

## Settings, Audit, Notifications

| Method | Path | Permission |
|---|---|---|
| GET/PUT | `/settings` | read / `settings:update` |
| GET/POST | `/audit` | `audit_logs:read` (immutable) |
| GET/PATCH | `/notifications` | read (PATCH = mark all read) |
| PATCH | `/notifications/:id` | read (mark one read) |

## Integrations (WooCommerce)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/integrations/woocommerce` | `integrations:read` | **masked config** — consumer secret never returned |
| PUT | `/integrations/woocommerce` | `integrations:update` | save config |
| POST | `/integrations/woocommerce` | `integrations:sync` | `?action=test` connection test |
| POST | `/integrations/woocommerce/sync?entity=products` | `integrations:sync` | bulk product sync |
| POST | `/integrations/woocommerce/sync?entity=orders` | `integrations:sync` | bulk order sync |
| GET | `/integrations/woocommerce/sync` | `integrations:read` | sync logs |
| POST | `/integrations/woocommerce/webhook` | — | **idempotent** webhook receiver, HMAC verified |

## Exports (CSV)

| Method | Path | Permission | Types |
|---|---|---|---|
| GET | `/exports/:type` | `exports:read` | `orders, customers, products, inventory, purchases, expenses, payments, profit-loss` |
