# Money Migration — Float → Integer Minor Units

**Status:** Release 1 (foundation) + Release 2 (add columns + dual-write + backfill) DONE in Phase 7. Reads still use Float columns — switch is Release 4.
**Last updated:** 2026-08-28

## Problem

MongoDB has no native `Decimal` type. Z-CRM stores all monetary fields as `Float` (float64). This loses precision at large magnitudes — a ৳100,000.50 order can drift by a few poisha on every read/write round-trip. The industry-standard fix is to store money as an **integer count of the smallest currency unit** (1/100 of a Taka = 1 poisha):

```
৳100.00 → 10000  (integer, exact)
৳100.50 → 10050
৳1,999.99 → 199999
```

## Phase 4 Foundation

Phase 4 created `src/lib/money.ts` with the conversion utilities:

- `toMinor(amount)` — taka (Decimal/number/string) → integer poisha
- `fromMinor(minor)` — integer poisha → Decimal taka
- `minorToDisplay(minor)` — integer poisha → display string
- `toMoneySafe(amount)` — safe Float-write helper (normalises null/NaN → 0)
- `formatMoney(amount)` — 2-decimal display string
- `roundMoney(amount)` — round to 2 decimals (poisha precision)
- `sumMoney(amounts[])` — sum a list of money amounts
- `backfillMinor(floatValue)` — convert existing Float data to minor units (for migration)
- `verifyMinorToFloat(minor)` — reverse conversion for verification

All utilities are unit-tested in `tests/crm/money.test.ts` (40 tests, all pass).

## Migration Strategy (Multi-Release)

### Release 1 — Foundation (DONE in Phase 4)
- ✅ Created `src/lib/money.ts` with conversion utilities
- ✅ Unit tests verify round-trip conversion is lossless

### Release 2 — Add Integer Columns (NOT YET DONE)
Add `Int` minor-unit columns alongside the existing `Float` columns:

```prisma
model Order {
  // ... existing Float columns (KEEP for now)
  subtotal      Float  @default(0)
  total         Float  @default(0)
  // ... etc.

  // NEW: integer minor-unit columns (nullable initially)
  subtotalMinor Int?
  totalMinor    Int?
  // ... etc.
}
```

**Backfill script** (`scripts/backfill-money.ts`, to be created):
```typescript
import { backfillMinor } from "@/lib/money";
// For each Order: subtotalMinor = backfillMinor(order.subtotal)
```

Run via `bun run scripts/backfill-money.ts`. Safe because:
- New columns are nullable (existing rows have `null` until backfilled)
- No reads depend on the new columns yet
- Can be re-run safely (idempotent — backfills rows where `*Minor` is null)

### Release 3 — Dual-Write (NOT YET DONE)
Update all services to write BOTH columns:
```typescript
await tx.order.create({
  data: {
    subtotal: subtotal.toNumber(),        // legacy Float
    subtotalMinor: toMinor(subtotal),     // new Int
    total: total.toNumber(),
    totalMinor: toMinor(total),
    // ...
  },
});
```

**Verification:** After deploy, run a script that samples N orders and confirms `fromMinor(order.totalMinor).toFixed(2) === order.total.toFixed(2)` for all of them.

### Release 4 — Switch Reads (NOT YET DONE)
Update all services to READ from the new Int columns:
```typescript
const total = fromMinor(order.totalMinor);  // Decimal, exact
// instead of: const total = toDecimal(order.total);
```

### Release 5 — Remove Float Columns (NOT YET DONE)
After a verification period (1-2 weeks of production traffic):
```prisma
model Order {
  subtotal      Int  @default(0)  // was Float, now Int minor units
  total         Int  @default(0)
  // ...
}
```

Drop the `*Minor` suffix (the Int columns become the canonical fields).

## Rollback Strategy

At any point before Release 5:
- **Release 2/3 rollback:** Drop the `*Minor` columns. No data loss — the Float columns are still the source of truth.
- **Release 4 rollback:** Revert the read paths to use Float columns. The Int columns are still populated (dual-write), so no data loss.

After Release 5 (Float columns removed), rollback requires a re-migration script to convert Int back to Float — but this is lossy (Float can't represent all minor-unit integers exactly at extreme magnitudes). **Don't revert after Release 5.**

## Affected Models (Audit)

Every monetary field in the schema needs a `*Minor` companion:

| Model | Fields |
|-------|--------|
| `Order` | subtotal, discount, tax, shippingCost, otherIncome, otherCost, packagingCost, paymentFee, platformFee, total, paidAmount, cogsTotal, grossProfit, netProfit |
| `OrderItem` | unitPrice, unitCost, discount, total |
| `Payment` | amount |
| `Refund` | amount |
| `Expense` | amount |
| `Purchase` | subtotal, discount, shippingCost, otherCost, total, paidAmount, dueAmount |
| `PurchaseItem` | unitCost, total |
| `PurchaseReturn` | total |
| `PurchaseReturnItem` | unitCost, total |
| `SupplierPayment` | amount |
| `Delivery` | deliveryCharge, actualCourierCost, returnCharge, codAmount, collectedAmount |
| `CashRegister` | openingBalance, cashSales, customerPayments, refunds, expenses, closingBalance |
| `Product` | purchasePrice, sellingPrice, wholesalePrice, weightedAverageCost, minimumStockLevel |
| `ProductVariant` | purchasePrice, sellingPrice, stock |
| `Wallet` | balance, totalDeposited, totalWithdrawn, totalSpent |
| `WalletTransaction` | amount |
| `PaymentOrder` | amount |
| `Subscription` | amount |
| `PayoutRequest` | amount |
| `SalesPipelineEntry` | value |
| `CustomerCredit` | advanceAmount, creditLimit |

## Current Status (Phase 7)

### Release 1 — Foundation (DONE in Phase 4)
- ✅ `src/lib/money.ts` exists with all conversion utilities (toMinor, fromMinor, backfillMinor, etc.)
- ✅ 40 unit tests verify round-trip conversion is lossless

### Release 2 — Add Columns + Dual-Write + Backfill (DONE in Phase 7)
- ✅ `Order` model now has `*Minor Int?` columns: `totalMinor`, `paidAmountMinor`, `cogsTotalMinor`, `grossProfitMinor`, `netProfitMinor`
- ✅ `OrderService.create` dual-writes `totalMinor` and `paidAmountMinor` alongside the Float columns
- ✅ `ProfitabilityService.persistSnapshot` dual-writes `cogsTotalMinor`, `grossProfitMinor`, `netProfitMinor`
- ✅ Backfill script: `scripts/backfill-money.ts` (supports `--dry-run`)
- ✅ All new columns are nullable (existing rows have `null` until backfilled)

### Release 3 — Validate (NEXT, not yet done)
- ❌ Run backfill script against production
- ❌ Run a verification script that samples N orders and confirms `fromMinor(order.totalMinor).toFixed(2) === order.total.toFixed(2)`
- ❌ Monitor for any dual-write discrepancies over 1-2 weeks of production traffic

### Release 4 — Switch Reads (NOT YET DONE)
- ❌ Update services to read from `*Minor` columns instead of Float
- ❌ Update API responses to return minor-unit integers
- ❌ Update Telegram display to convert minor → major at the presentation layer

### Release 5 — Remove Float Columns (NOT YET DONE)
- ❌ Drop the Float columns (after verification period)

## Rollback

At any point before Release 5:
- **Release 2 rollback:** Drop the `*Minor` columns. No data loss — Float columns are still the source of truth.
- **Release 4 rollback:** Revert reads to use Float columns. The `*Minor` columns are still populated (dual-write), so no data loss.

After Release 5 (Float columns removed), rollback requires a re-migration script to convert Int back to Float — but this is lossy. **Don't revert after Release 5.**

**The migration is architecturally ready but not switched on.** Switching requires the multi-release process above.
