# Inventory & the Stock Movement Ledger

> **Inventory has one authoritative source: the Stock Movement ledger.** `Inventory.quantity` is never edited directly outside a transaction that also writes a `StockMovement`.

## Movement types

| Type | Stock effect | Triggered by |
|---|---|---|
| `PURCHASE` | sellable **+** qty | Purchase received |
| `SALE` | sellable **−** qty | Order created |
| `RETURN` | sellable **+** qty | GOOD customer return |
| `DAMAGE` | sellable **−** qty, damaged **+** qty | Manual damage / DAMAGED return |
| `ADJUSTMENT` | sellable **±** qty | Manual adjustment |
| `TRANSFER_IN` | sellable **+** qty | Manual transfer in |
| `TRANSFER_OUT` | sellable **−** qty | Manual transfer out |

## Movement record

Each `StockMovement` stores: `productId`, `type`, `quantityChange` (signed), `previousQuantity`, `newQuantity`, `referenceType` (ORDER/PURCHASE/RETURN/MANUAL), `referenceId`, `reason`, `createdBy`, `createdAt`. This makes every stock change fully traceable.

## Concurrency & atomicity

Stock operations happen **inside the owning business transaction** — the `OrderService.create` transaction creates the order AND applies SALE movements with the same `tx` client. This means:

- Two simultaneous orders cannot corrupt stock (the read-modify-write is serialised inside one transaction).
- If the order creation fails, the stock deduction is rolled back too (atomic).
- We never open a *nested* `db.$transaction` (which would deadlock on SQLite's single-writer lock). `InventoryService.applyMovementInTx(tx, ...)` reuses the caller's transaction client.

## Negative-stock prevention

By default a movement that would drive sellable stock below zero throws `Insufficient stock for <sku>. Available: X, requested: Y`. This can be disabled per-business via `Setting.allowNegativeStock = "true"` (not recommended).

## DAMAGED bucket

`Inventory` has both `quantity` (sellable) and `damagedQuantity`. Damaging N units moves N from sellable to damaged (sellable −N, damaged +N) so the totals reconcile. GOOD returns restore sellable stock; DAMAGED returns move to the damaged bucket.

## Traceability

A user can follow the chain end-to-end:

```
Profit Report → Order → OrderItem (unitCost snapshot) → StockMovement (SALE)
                                          → Product purchasePrice
                                          → Payment → Expense
```

Every number in reports can be traced back to the movements that produced it.
