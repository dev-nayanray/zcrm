import { db } from "@/lib/db";
import { Prisma, PrismaClient } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";
import type { StockMovementType } from "@/lib/constants";
import { NotificationService } from "./notification";

// InventoryService — the SINGLE authoritative source for stock.
//
// Available Stock = quantity (physical) − reservedQuantity
//
// Movement types: PURCHASE, SALE, RETURN, DAMAGE, ADJUSTMENT, TRANSFER_IN,
// TRANSFER_OUT, RESERVATION (+reserved), RELEASE (−reserved).
//
// When called from inside another service's transaction (e.g. OrderService),
// pass the `tx` client to AVOID nested transactions (deadlock on SQLite).

type MovementInput = {
  productId: string;
  type: StockMovementType;
  quantityChange: Prisma.Decimal | number | string; // signed
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  createdBy?: string | null;
  warehouseId?: string | null;
};

type TxClient = Prisma.TransactionClient | PrismaClient;

async function getOrCreateInventory(tx: TxClient, productId: string) {
  let inv = await tx.inventory.findUnique({ where: { productId } });
  if (!inv) {
    inv = await tx.inventory.create({
      data: {
        productId,
        quantity: new Prisma.Decimal(0),
        reservedQuantity: new Prisma.Decimal(0),
        damagedQuantity: new Prisma.Decimal(0),
        minimumStock: new Prisma.Decimal(0),
        maximumStock: new Prisma.Decimal(0),
        reorderLevel: new Prisma.Decimal(0),
      },
    });
  }
  return inv;
}

async function applyMovementInTx(tx: TxClient, input: MovementInput, opts?: { allowNegative?: boolean }) {
  const product = await tx.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new Error("Product not found");

  const inventory = await getOrCreateInventory(tx, input.productId);

  const change = toDecimal(input.quantityChange);
  const previous = toDecimal(inventory.quantity);
  const previousReserved = toDecimal(inventory.reservedQuantity);
  const previousDamaged = toDecimal(inventory.damagedQuantity);

  // RESERVATION: increase reserved bucket (does NOT change physical quantity)
  if (input.type === "RESERVATION") {
    const available = previous.minus(previousReserved);
    if (change.gt(available) && !opts?.allowNegative) {
      throw new Error(`Insufficient available stock to reserve for ${product.sku}. Available: ${available.toFixed(0)}, requested: ${change.toFixed(0)}`);
    }
    const newReserved = previousReserved.plus(change);
    const updated = await tx.inventory.update({
      where: { productId: input.productId },
      data: { reservedQuantity: newReserved },
    });
    const movement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        type: input.type,
        quantityChange: change,
        previousQuantity: previous,
        newQuantity: previous, // physical unchanged
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        reason: input.reason,
        createdBy: input.createdBy ?? null,
        warehouseId: input.warehouseId ?? null,
      },
    });
    return { movement, inventory: updated, damagedQuantity: previousDamaged };
  }

  // RELEASE: decrease reserved bucket (e.g. order cancelled). The ledger
  // records the ACTUAL delta (clamped to previousReserved) so the movement
  // history can always be used to reconstruct reservedQuantity — the
  // previous implementation recorded the full requested release amount
  // even when reserved was clamped to 0, leaving the ledger inconsistent
  // with the Inventory row.
  if (input.type === "RELEASE") {
    const actualChange = change.gt(previousReserved) ? previousReserved : change;
    const newReserved = previousReserved.minus(actualChange);
    const updated = await tx.inventory.update({
      where: { productId: input.productId },
      data: { reservedQuantity: newReserved },
    });
    const movement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        type: input.type,
        quantityChange: actualChange.negated(),
        previousQuantity: previous,
        newQuantity: previous,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        reason: input.reason,
        createdBy: input.createdBy ?? null,
        warehouseId: input.warehouseId ?? null,
      },
    });
    return { movement, inventory: updated, damagedQuantity: previousDamaged };
  }

  // DAMAGED_RETURN: customer returned a damaged item — only the damaged
  // bucket increases; sellable is NOT touched (the customer kept the
  // sellable stock out of the warehouse). This is distinct from a DAMAGE
  // movement (internal sellable→damaged conversion).
  if (input.type === "DAMAGED_RETURN") {
    if (change.lte(0)) {
      throw new Error(`DAMAGED_RETURN requires a positive quantity for ${product.sku}`);
    }
    const updated = await tx.inventory.update({
      where: { productId: input.productId },
      data: { damagedQuantity: previousDamaged.plus(change) },
    });
    const movement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        type: input.type,
        quantityChange: change,
        previousQuantity: previous,
        newQuantity: previous, // physical unchanged
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        reason: input.reason,
        createdBy: input.createdBy ?? null,
        warehouseId: input.warehouseId ?? null,
      },
    });
    return { movement, inventory: updated, damagedQuantity: updated.damagedQuantity };
  }

  // DAMAGE: move from sellable → damaged bucket (internal conversion).
  // Reject non-positive change so the audit's "DAMAGE with change <= 0
  // falls through to generic SALE/RETURN path" bug can never recur — the
  // generic path would silently decrease sellable without updating the
  // damaged bucket.
  if (input.type === "DAMAGE") {
    if (!change.gt(0)) {
      throw new Error(`DAMAGE requires a positive quantity for ${product.sku}`);
    }
    if (previous.minus(change).lt(0) && !opts?.allowNegative) {
      throw new Error(`Insufficient sellable stock to mark as damaged for ${product.sku}`);
    }
    const updated = await tx.inventory.update({
      where: { productId: input.productId },
      data: { quantity: previous.minus(change), damagedQuantity: previousDamaged.plus(change) },
    });
    const movement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        type: input.type,
        quantityChange: change.negated(),
        previousQuantity: previous,
        newQuantity: updated.quantity,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        reason: input.reason,
        createdBy: input.createdBy ?? null,
        warehouseId: input.warehouseId ?? null,
      },
    });
    return { movement, inventory: updated, damagedQuantity: updated.damagedQuantity };
  }

  // PURCHASE / SALE / RETURN / ADJUSTMENT / TRANSFER_IN / TRANSFER_OUT
  const next = previous.plus(change);
  if (!opts?.allowNegative && next.lt(0)) {
    throw new Error(`Insufficient stock for ${product.sku}. Available: ${previous.toFixed(0)}, requested: ${change.abs().toFixed(0)}`);
  }
  const updated = await tx.inventory.update({
    where: { productId: input.productId },
    data: { quantity: next },
  });
  const movement = await tx.stockMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantityChange: change,
      previousQuantity: previous,
      newQuantity: next,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      reason: input.reason,
      createdBy: input.createdBy ?? null,
      warehouseId: input.warehouseId ?? null,
    },
  });

  // Low-stock → reorder notification (fire-and-forget, after the write)
  try {
    const min = toDecimal(updated.minimumStock).gt(0) ? toDecimal(updated.minimumStock) : toDecimal(product.minimumStockLevel);
    const reorder = toDecimal(updated.reorderLevel);
    const threshold = reorder.gt(0) ? reorder : min;
    const available = toDecimal(updated.quantity).minus(toDecimal(updated.reservedQuantity));
    if (threshold.gt(0) && available.lte(threshold)) {
      const existing = await tx.notification.findFirst({
        where: { type: available.lte(0) ? "OUT_OF_STOCK" : "LOW_STOCK", link: `/inventory?product=${input.productId}`, isRead: false },
      });
      if (!existing) {
        const suggested = toDecimal(product.minimumStockLevel).gt(0)
          ? Prisma.Decimal.max(toDecimal(product.minimumStockLevel).times(2).minus(available), new Prisma.Decimal(0))
          : new Prisma.Decimal(10);
        await tx.notification.create({
          data: {
            type: available.lte(0) ? "OUT_OF_STOCK" : "LOW_STOCK",
            title: available.lte(0) ? "Out of stock" : "Low stock — reorder suggested",
            message: `${product.name} (${product.sku}) has ${available.toFixed(0)} available. Suggested reorder: ${suggested.toFixed(0)} units.`,
            link: `/inventory?product=${input.productId}`,
          },
        });
        // Route to Telegram groups (non-blocking, after tx)
        const eventType = available.lte(0) ? "OUT_OF_STOCK" : "LOW_STOCK";
        void (import("./telegram").then(({ TelegramService }) =>
          TelegramService.routeNotification(eventType, `${available.lte(0) ? "🚨" : "⚠️"} <b>${eventType.replace(/_/g, " ")}</b>\n${product.name} (${product.sku}): ${available.toFixed(0)} available. Reorder: ${suggested.toFixed(0)} units.`)
        ).catch(() => {}));
      }
    }
  } catch {
    // notification failures must never break the inventory transaction
  }

  // Push stock update back to WooCommerce (fire-and-forget, after tx).
  // The Woo push must happen OUTSIDE the tx — if it ran inside, the Woo
  // API call latency would hold the tx open for seconds and the Woo
  // server being down would roll back the entire inventory adjustment.
  // We schedule it via microtask so the tx commits first.
  if (product.externalId) {
    void Promise.resolve().then(() =>
      import("./woocommerce").then(({ WooCommerceService }) =>
        WooCommerceService.pushStockUpdate(input.productId, Number(toDecimal(updated.quantity).toFixed(0)))
      ).catch(() => {})
    );
  }

  return { movement, inventory: updated, damagedQuantity: previousDamaged };
}

export const InventoryService = {
  /** Apply a stock movement within its own transaction. */
  async applyMovement(input: MovementInput, opts?: { allowNegative?: boolean; damaged?: boolean }) {
    return db.$transaction(async (tx) => applyMovementInTx(tx, input, opts), {
      timeout: 20000,
      maxWait: 10000,
    });
  },

  /** Apply a stock movement within an existing transaction (no nested $transaction). */
  async applyMovementInTx(tx: TxClient, input: MovementInput, opts?: { allowNegative?: boolean }) {
    return applyMovementInTx(tx, input, opts);
  },

  /** Reserve stock for a pending order (increases reservedQuantity). */
  async reserveInTx(tx: TxClient, input: { productId: string; quantity: Prisma.Decimal | number | string; referenceId?: string; reason?: string; createdBy?: string | null }) {
    return applyMovementInTx(tx, {
      productId: input.productId,
      type: "RESERVATION",
      quantityChange: input.quantity,
      referenceType: "ORDER",
      referenceId: input.referenceId,
      reason: input.reason ?? "Stock reservation",
      createdBy: input.createdBy ?? null,
    });
  },

  /** Release reserved stock (e.g. order cancelled). */
  async releaseInTx(tx: TxClient, input: { productId: string; quantity: Prisma.Decimal | number | string; referenceId?: string; reason?: string; createdBy?: string | null }) {
    return applyMovementInTx(tx, {
      productId: input.productId,
      type: "RELEASE",
      quantityChange: input.quantity,
      referenceType: "ORDER",
      referenceId: input.referenceId,
      reason: input.reason ?? "Reservation released",
      createdBy: input.createdBy ?? null,
    });
  },

  /** Convert a reservation into an actual SALE (deduct physical + reserved). */
  async convertReservationToSaleInTx(tx: TxClient, input: { productId: string; quantity: Prisma.Decimal | number | string; referenceId?: string; reason?: string; createdBy?: string | null }) {
    // 1) release the reservation (decrement reserved)
    await applyMovementInTx(tx, {
      productId: input.productId,
      type: "RELEASE",
      quantityChange: input.quantity,
      referenceType: "ORDER",
      referenceId: input.referenceId,
      reason: `Convert reservation → sale`,
      createdBy: input.createdBy ?? null,
    });
    // 2) deduct physical (SALE)
    return applyMovementInTx(tx, {
      productId: input.productId,
      type: "SALE",
      quantityChange: toDecimal(input.quantity).negated(),
      referenceType: "ORDER",
      referenceId: input.referenceId,
      reason: input.reason ?? "Sale (reservation converted)",
      createdBy: input.createdBy ?? null,
    });
  },

  async getOrCreate(productId: string) {
    let inv = await db.inventory.findUnique({ where: { productId } });
    if (!inv) {
      inv = await db.inventory.create({
        data: { productId, quantity: new Prisma.Decimal(0), damagedQuantity: new Prisma.Decimal(0) },
      });
    }
    return inv;
  },

  async movements(productId: string, opts: { page: number; limit: number }) {
    const { page, limit } = opts;
    const [items, total] = await Promise.all([
      db.stockMovement.findMany({
        where: { productId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { creator: { select: { id: true, name: true } } },
      }),
      db.stockMovement.count({ where: { productId } }),
    ]);
    return { items, total };
  },

  /** Movements across all products with filtering (for the Stock Movements page + reports). */
  async allMovements(opts: { page: number; limit: number; productId?: string; type?: string; createdBy?: string; from?: Date; to?: Date; referenceType?: string; referenceId?: string }) {
    const where: Prisma.StockMovementWhereInput = {};
    if (opts.productId) where.productId = opts.productId;
    if (opts.type) where.type = opts.type;
    if (opts.createdBy) where.createdBy = opts.createdBy;
    if (opts.referenceType) where.referenceType = opts.referenceType;
    if (opts.referenceId) where.referenceId = opts.referenceId;
    if (opts.from || opts.to) {
      const created: Record<string, Date> = {};
      if (opts.from) created.gte = opts.from;
      if (opts.to) created.lte = opts.to;
      where.createdAt = created;
    }
    const [items, total] = await Promise.all([
      db.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        include: { product: { select: { id: true, name: true, sku: true } }, creator: { select: { id: true, name: true } } },
      }),
      db.stockMovement.count({ where }),
    ]);
    return { items, total };
  },

  /** Stock valuation + inventory dashboard aggregates. */
  async stockValue() {
    const rows = await db.inventory.findMany({
      include: { product: { select: { purchasePrice: true, sellingPrice: true, name: true, sku: true, minimumStockLevel: true, status: true } } },
    });
    let totalCost = new Prisma.Decimal(0);
    let totalRetail = new Prisma.Decimal(0);
    let totalUnits = new Prisma.Decimal(0);
    let totalReserved = new Prisma.Decimal(0);
    let totalDamaged = new Prisma.Decimal(0);
    const items = rows.map((r) => {
      const qty = toDecimal(r.quantity);
      const reserved = toDecimal(r.reservedQuantity);
      const damaged = toDecimal(r.damagedQuantity);
      const cost = toDecimal(r.product.purchasePrice);
      const retail = toDecimal(r.product.sellingPrice);
      totalCost = totalCost.plus(qty.times(cost));
      totalRetail = totalRetail.plus(qty.times(retail));
      totalUnits = totalUnits.plus(qty);
      totalReserved = totalReserved.plus(reserved);
      totalDamaged = totalDamaged.plus(damaged);
      const available = qty.minus(reserved);
      return {
        productId: r.productId,
        name: r.product.name,
        sku: r.product.sku,
        quantity: qty.toFixed(3),
        reservedQuantity: reserved.toFixed(3),
        damagedQuantity: damaged.toFixed(3),
        available: available.toFixed(3),
        minimumStock: toDecimal(r.minimumStock).toFixed(0),
        maximumStock: toDecimal(r.maximumStock).toFixed(0),
        reorderLevel: toDecimal(r.reorderLevel).toFixed(0),
        costValue: qty.times(cost).toFixed(2),
        retailValue: qty.times(retail).toFixed(2),
        stockStatus: available.lte(0) ? "OUT_OF_STOCK" : (toDecimal(r.reorderLevel).gt(0) && available.lte(toDecimal(r.reorderLevel))) ? "LOW_STOCK" : (toDecimal(r.minimumStock).gt(0) && available.lte(toDecimal(r.minimumStock))) ? "LOW_STOCK" : "HEALTHY",
      };
    });
    return {
      items,
      totalCost: totalCost.toFixed(2),
      totalRetail: totalRetail.toFixed(2),
      totalUnits: totalUnits.toFixed(3),
      totalReserved: totalReserved.toFixed(3),
      totalDamaged: totalDamaged.toFixed(3),
      totalAvailable: totalUnits.minus(totalReserved).toFixed(3),
    };
  },

  /** Today's stock-in / stock-out summary. */
  async movementSummaryToday() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const where = { createdAt: { gte: start, lte: end } };
    const inTypes = ["PURCHASE", "RETURN", "ADJUSTMENT", "TRANSFER_IN"];
    const outTypes = ["SALE", "DAMAGE", "TRANSFER_OUT"];
    const movements = await db.stockMovement.findMany({ where, select: { type: true, quantityChange: true } });
    let stockIn = new Prisma.Decimal(0);
    let stockOut = new Prisma.Decimal(0);
    for (const m of movements) {
      const c = toDecimal(m.quantityChange);
      if (inTypes.includes(m.type)) stockIn = stockIn.plus(c.abs());
      else if (outTypes.includes(m.type)) stockOut = stockOut.plus(c.abs());
    }
    return {
      stockIn: stockIn.toFixed(3),
      stockOut: stockOut.toFixed(3),
      movementCount: movements.length,
    };
  },
};

// keep NotificationService referenced (used inside transactions for low-stock alerts)
void NotificationService;
