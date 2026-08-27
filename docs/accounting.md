# Accounting & Profit / Loss

> **One centralized `AccountingService` (`src/lib/services/accounting.ts`) is used by the Dashboard, the P&L report and every financial report.** Accounting formulas are never duplicated across pages.

## The model

```
Gross Sales    = Σ order.subtotal        (for non-CANCELLED orders in range)
Discounts      = Σ order.discount
Shipping       = Σ order.shippingCost
Other Costs    = Σ order.otherCost
Revenue        = Σ order.total           (= subtotal − discount + shipping + other)

COGS           = Σ (orderItem.unitCost × orderItem.quantity)
                 ↑ historical snapshot, taken at order time.
                   Changing a product's purchasePrice later does NOT
                   affect historical order profitability.

Refunds        = Σ refund.amount         (in range)

Net Revenue    = Revenue − Refunds
Gross Profit   = Net Revenue − COGS
Operating Exp. = Σ expense.amount        (by expenseDate in range)
Net Profit     = Gross Profit − Operating Expenses
```

## Per-order profit (order detail page)

```
Profit = order.total − Σ(item.unitCost × item.quantity) − order.shippingCost − order.otherCost
```

Example (matches the prompt's example): selling price ৳1,500, product cost ৳800, delivery ৳100, other ৳50 → profit ৳550.

## Why historical snapshots

`OrderItem` stores `productName`, `sku`, `unitPrice` (selling price) and `unitCost` (purchase cost) **at the moment the order is created**, copied from the `Product` row by the `OrderService` (the frontend never supplies these). If you later edit a product's price, every existing order keeps its original numbers — so historical P&L is immutable and accurate.

## Payment status

`Order.paymentStatus` is **always recomputed from actual `Payment` records**:

- `PAID`     when `Σ payment.amount ≥ order.total`
- `PARTIAL`  when `0 < Σ payment.amount < order.total`
- `UNPAID`   when no payments
- `REFUNDED` after a full refund

Overpayment is prevented at the `PaymentService` level (`Payment exceeds outstanding amount`).

## Decimal, not float

All money fields are Prisma `Decimal`. `src/lib/decimal.ts` provides `toDecimal`, `addMoney`, `subMoney`, `mulMoney`, `cmpMoney`, `formatCurrency` — no floating-point arithmetic touches money anywhere.

## Where it's used

- **Dashboard** — today KPIs, range P&L, monthly snapshot, trend (30d), sales-by-channel, top products — all from `AccountingService`.
- **P&L report** (`/reports/profit-loss`) — `profitAndLoss(range)`.
- **Sales report** — aggregates + `salesByChannel` + `topProducts`.
- **Payments report** — `paymentStats` + outstanding orders.
- **Expense report** — `expenseByCategory`.
- **Inventory report** — `InventoryService.stockValue` + movements.
- **Product/Customer reports** — derived from order items & payments.
- **Order detail** — per-order COGS and profit.

Because every consumer calls the same service, the numbers always reconcile.
