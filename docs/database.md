# Database

Prisma schema with 68 models. MongoDB Atlas (production). All monetary fields stored as `Float` (MongoDB has no native Decimal type); arithmetic uses `Prisma.Decimal` via `src/lib/decimal.ts`.

## Auth, Users, Roles

| Model | Purpose |
|---|---|
| `User` | email (unique), name, phone, `passwordHash` (PBKDF2), `roleId`, `isActive`, `lastLoginAt` |
| `Role` | name (unique: SUPER_ADMIN/ADMIN/MANAGER/SALES/INVENTORY/ACCOUNTANT), `isSystem` |
| `Permission` | action (unique, e.g. `orders:create`); permissions referenced via `Role.permissionActions` String[] |

## CRM

| Model | Key fields / relationships |
|---|---|
| `Customer` | name, phone (**unique**), email, address, city, notes, `externalId` (Woo id). Has many `Order`, `Payment`, `Return` |
| `Category` | name, slug (**unique**), `parentId` (self-relation "CategoryTree"), status, sortOrder, externalId. Circular parent prevented in service |
| `Product` | sku (**unique**), slug (**unique**), categoryId, brand, `purchasePrice`/`sellingPrice`/`wholesalePrice`/`minimumStockLevel` (Float), status, externalId. Has one `Inventory` |
| `Supplier` | name, phone, email, address, company, notes. Has many `Purchase` |
| `Channel` | name (**unique**): Website, Facebook, Messenger, WhatsApp, Phone, Physical Store, Other |

## Orders & Order Items (historical snapshots)

| Model | Key fields |
|---|---|
| `Order` | `orderNumber` (**unique**), customerId, channelId, status, `paymentStatus`, `subtotal`/`discount`/`shippingCost`/`otherCost`/`total`/`paidAmount` (Float), `externalId`, `syncStatus`, `createdBy`. Has many `OrderItem`, `Payment`, `Return`, `Refund`, `OrderStatusHistory` |
| `OrderItem` | `productId`, **`productName`** (snapshot), **`sku`** (snapshot), `quantity`, **`unitPrice`** (snapshot), **`unitCost`** (snapshot = COGS), discount, total. Indexed by orderId & productId |
| `OrderStatusHistory` | orderId, status, note, createdBy — append-only audit of status changes |

## Inventory & Stock Movements (ledger)

| Model | Key fields |
|---|---|
| `Inventory` | `productId` (**unique** 1:1 with Product), `quantity` (sellable), `damagedQuantity`. Updated only inside a transaction that also writes a StockMovement |
| `StockMovement` | productId, type (PURCHASE/SALE/RETURN/DAMAGE/ADJUSTMENT/TRANSFER_IN/TRANSFER_OUT), `quantityChange` (signed), `previousQuantity`, `newQuantity`, `referenceType` (ORDER/PURCHASE/RETURN/MANUAL), `referenceId`, reason, createdBy. Indexed on (referenceType, referenceId) |

## Purchases, Expenses, Returns, Refunds

| Model | Key fields |
|---|---|
| `Purchase` | `purchaseNumber` (**unique**), supplierId, status (PENDING/RECEIVED/CANCELLED), subtotal/discount/shippingCost/total/paidAmount/dueAmount (Float), paymentStatus, createdBy |
| `PurchaseItem` | productId, quantity, `unitCost`, total |
| `ExpenseCategory` | name (**unique**): Delivery/Packaging/Marketing/Salary/Rent/Utility/Office/Transport/Other |
| `Expense` | categoryId, amount, `paymentMethod`, description, reference, `expenseDate`, createdBy |
| `Return` | orderId, customerId, status, type (RETURN/EXCHANGE), reason, `refundAmount`, createdBy. Has many `ReturnItem`, `Refund` |
| `ReturnItem` | productId, quantity, `condition` (GOOD/DAMAGED) |
| `Refund` | orderId, paymentId?, returnId?, amount, method, transactionReference, createdBy |

## Integrations, Notifications, Audit, Settings

| Model | Key fields |
|---|---|
| `Integration` | name (**unique** e.g. "woocommerce"), `config` (JSON: url/consumerKey/consumerSecret/webhookSecret), status, lastSyncAt |
| `SyncLog` | entity, externalId, operation, status (PENDING/SUCCESS/FAILED), message, attemptCount, payload. **Unique on (entity, externalId, operation)** → idempotent upserts |
| `Notification` | type (LOW_STOCK/NEW_ORDER/PAYMENT_RECEIVED/SYNC_FAILED/PENDING_PAYMENT/PURCHASE_DUE), title, message, link, isRead, userId (null = broadcast) |
| `AuditLog` | userId?, action (LOGIN/ORDER_CREATE/STOCK_ADJUST/…), entity, entityId?, `changes` (JSON), ipAddress. Immutable |
| `Setting` | key (**unique**), value |

## Concurrency & integrity

- `db.$transaction` for: order create, payment create, purchase create/receive, returns, refunds, stock adjustments.
- Stock movements happen **inside** the owning transaction (passed `tx`) — never a nested `db.$transaction`.
- Audit logs are written inside the same transaction (passed `tx`) so the audit trail commits atomically with the business change.
- Negative stock prevented unless `Setting.allowNegativeStock = "true"`.
- Unique constraints on sku, slug, orderNumber, purchaseNumber, phone, externalId pairs.

## Indexes

Every foreign key, every frequently-filtered column (`status`, `paymentStatus`, `method`, `createdAt`, `expenseDate`), and the composite `(referenceType, referenceId)` on StockMovement for fast order/purchase/return lookups.
