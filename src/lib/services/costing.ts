import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";

// CostingService — Weighted Average Cost (WAC) engine.
//
// ─────────────────────────────────────────────────────────────────────────────
// METHOD SELECTION & RATIONALE
// ─────────────────────────────────────────────────────────────────────────────
// Z-CRM uses **Weighted Average Cost** as its COGS method. This was chosen
// over FIFO/LIFO/specific-identification for three reasons:
//
//  1. **Single-product blending**: Most Z-CRM merchants sell the same SKU
//     purchased at different prices over time (restock at higher/lower cost).
//     WAC produces a single, stable unit cost that smooths price volatility
//     — better than "most recent purchase price" (which the previous
//     implementation used) for matching revenue against cost.
//
//  2. **MongoDB compatibility**: Specific-identification requires a
//     per-batch `lotId` column and is expensive to maintain. FIFO requires
//     a sorted queue of (qty, cost) pairs per product. WAC needs only one
//     column (`Product.weightedAverageCost`) and one arithmetic operation
//     on each purchase receipt — cheap on MongoDB.
//
//  3. **Audit defensibility**: WAC is a GAAP/IFRS-compliant method that
//     works for both periodic and perpetual inventory. Bangladesh tax
//     authorities accept it.
//
// ─────────────────────────────────────────────────────────────────────────────
// FORMULA
// ─────────────────────────────────────────────────────────────────────────────
// When a purchase is received with `newQty` units at `newUnitCost`:
//
//   newWAC = (currentStock * currentWAC + newQty * newUnitCost)
//            / (currentStock + newQty)
//
// Where `currentStock` is the sellable quantity (Inventory.quantity −
// Inventory.reservedQuantity − Inventory.damagedQuantity) AT THE TIME OF
// PURCHASE. We use the sellable figure because damaged/reserved stock was
// already costed at its original purchase — we don't want to re-cost it.
//
// When stock is at zero (new product, or first purchase after a stockout),
// the WAC collapses to `newUnitCost` — the formula naturally handles this.
//
// ─────────────────────────────────────────────────────────────────────────────
// USAGE IN ORDER CREATION
// ─────────────────────────────────────────────────────────────────────────────
// When `OrderService.create` snapshots `OrderItem.unitCost`, it now reads
// `Product.weightedAverageCost` (falling back to `Product.purchasePrice`
// for back-compat with seeded products that haven't been re-costed). The
// snapshot is immutable — later purchase price changes do not affect
// historical order profitability.
//
// ─────────────────────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────
// • Negative stock: if `currentStock + newQty <= 0` (shouldn't happen,
//   but defensive), we fall back to `newUnitCost` so the WAC stays
//   non-zero and the order can still be costed.
// • Damaged returns: do NOT re-average — they go to the damaged bucket
//   and keep their original cost. See ReturnService.
// • Stock adjustments (ADJUSTMENT movement): do NOT change WAC. Stock
//   counts that find missing/damaged stock write off the existing WAC,
//   they don't recompute it.
// • Stock transfers: do NOT change WAC — both warehouses hold the same
//   product at the same WAC (the WAC is a property of the product, not
//   the warehouse). A future per-warehouse-WAC enhancement would require
//   moving the column from Product to WarehouseStock.

type TxClient = Prisma.TransactionClient;

export const CostingService = {
  /**
   * Recompute the Weighted Average Cost for a product after a purchase
   * receipt. MUST be called inside the purchase transaction so the WAC
   * update is atomic with the stock movement.
   *
   * @param tx — the active transaction client
   * @param productId
   * @param newQty — quantity just received (must be > 0)
   * @param newUnitCost — unit cost of the received batch
   */
  async recomputeWacInTx(
    tx: TxClient,
    productId: string,
    newQty: Prisma.Decimal | number,
    newUnitCost: Prisma.Decimal | number,
  ): Promise<Prisma.Decimal> {
    const qty = toDecimal(newQty);
    const unitCost = toDecimal(newUnitCost);
    if (qty.lte(0)) throw new Error("WAC recompute requires positive quantity");

    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error(`Product not found: ${productId}`);

    // Read the current sellable stock from the Inventory row (if any).
    // We use the LIVE inventory state inside this tx — the PURCHASE stock
    // movement has already been applied by the caller (PurchaseService),
    // so the inventory.quantity already reflects the new stock. To get the
    // PRE-purchase stock, we subtract `newQty`.
    const inventory = await tx.inventory.findUnique({ where: { productId } });
    const liveQuantity = toDecimal(inventory?.quantity ?? 0);
    const reserved = toDecimal(inventory?.reservedQuantity ?? 0);
    const damaged = toDecimal(inventory?.damagedQuantity ?? 0);
    const prePurchaseSellable = liveQuantity.minus(qty).minus(reserved).minus(damaged);

    const currentWac = toDecimal(product.weightedAverageCost);
    const fallbackCost = unitCost; // used when current stock is empty/invalid

    // WAC = (existingStock * existingWac + newQty * newUnitCost) / (existingStock + newQty)
    const totalQty = prePurchaseSellable.plus(qty);
    let newWac: Prisma.Decimal;
    if (totalQty.lte(0)) {
      // Defensive: shouldn't happen. Fall back to the new unit cost so
      // the product still has a non-zero cost basis.
      newWac = fallbackCost;
    } else {
      const existingValue = prePurchaseSellable.times(currentWac);
      const newValue = qty.times(unitCost);
      newWac = existingValue.plus(newValue).dividedBy(totalQty);
    }

    // Persist the new WAC and also update purchasePrice (the "latest cost"
    // field, kept for display + back-compat with code that reads it).
    // Schema stores Float — convert Decimal via toNumber().
    await tx.product.update({
      where: { id: productId },
      data: {
        weightedAverageCost: newWac.toNumber(),
        purchasePrice: unitCost.toNumber(), // latest-cost tracking (display only)
      },
    });

    return newWac;
  },

  // ─────────────────────────────────────────────────────────────────────
  // PER-WAREHOUSE WAC (Phase 7)
  //
  // Recompute the Weighted Average Cost for a product WITHIN a specific
  // warehouse. Called after a purchase is received into a warehouse (the
  // PURCHASE stock movement has already been applied by the caller).
  //
  // Formula:
  //   newWAC = (existingQty * existingWAC + receivedQty * newUnitCost)
  //            / (existingQty + receivedQty)
  //
  // The product-level WAC (recomputeWacInTx above) is ALSO recomputed —
  // it serves as the aggregate cost basis used by OrderService when the
  // order doesn't specify a warehouse (back-compat with Phase 2–6 orders).
  //
  // FALLBACK: if no WarehouseStock row exists for (warehouse, product),
  // we create one with the received quantity and set its WAC = newUnitCost.
  // If the warehouse is not specified (null), only the product-level WAC
  // is updated — warehouse WAC is skipped.
  // ─────────────────────────────────────────────────────────────────────
  async recomputeWarehouseWacInTx(
    tx: TxClient,
    productId: string,
    warehouseId: string | null | undefined,
    newQty: Prisma.Decimal | number,
    newUnitCost: Prisma.Decimal | number,
  ): Promise<{ warehouseWac: Prisma.Decimal | null; productWac: Prisma.Decimal }> {
    const qty = toDecimal(newQty);
    const unitCost = toDecimal(newUnitCost);
    if (qty.lte(0)) throw new Error("WAC recompute requires positive quantity");

    // Always recompute the product-level WAC (back-compat + aggregate view).
    const productWac = await this.recomputeWacInTx(tx, productId, qty, unitCost);

    // If no warehouse specified, skip the per-warehouse WAC.
    if (!warehouseId) return { warehouseWac: null, productWac };

    // Find or create the WarehouseStock row for this (warehouse, product).
    let ws = await tx.warehouseStock.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
    });
    if (!ws) {
      // Create with the received quantity + the new unit cost as WAC.
      // (First purchase into this warehouse → WAC = unit cost.)
      ws = await tx.warehouseStock.create({
        data: {
          warehouseId,
          productId,
          quantity: qty.toNumber(),
          reservedQuantity: 0,
          damagedQuantity: 0,
          weightedAverageCost: unitCost.toNumber(),
        },
      });
      return { warehouseWac: unitCost, productWac };
    }

    // WarehouseStock row exists — compute the new WAC.
    // IMPORTANT: the PURCHASE stock movement has already incremented
    // ws.quantity by `qty`. So `ws.quantity` now includes the received
    // units. We need the PRE-purchase quantity = ws.quantity - qty.
    const liveQuantity = toDecimal(ws.quantity);
    const reserved = toDecimal(ws.reservedQuantity);
    const damaged = toDecimal(ws.damagedQuantity);
    const prePurchaseSellable = liveQuantity.minus(qty).minus(reserved).minus(damaged);

    const currentWac = toDecimal(ws.weightedAverageCost);
    const totalQty = prePurchaseSellable.plus(qty);
    let newWac: Prisma.Decimal;
    if (totalQty.lte(0)) {
      newWac = unitCost; // defensive
    } else {
      const existingValue = prePurchaseSellable.times(currentWac);
      const newValue = qty.times(unitCost);
      newWac = existingValue.plus(newValue).dividedBy(totalQty);
    }

    await tx.warehouseStock.update({
      where: { id: ws.id },
      data: { weightedAverageCost: newWac.toNumber() },
    });

    return { warehouseWac: newWac, productWac };
  },

  /**
   * Get the warehouse-specific cost basis for a product in a warehouse.
   * Falls back to the product-level WAC if the warehouse has no WAC yet.
   * Used for inventory valuation and per-warehouse COGS (future: when
   * OrderService supports warehouse-specific order items).
   */
  async getWarehouseCostBasisInTx(tx: TxClient, productId: string, warehouseId: string): Promise<Prisma.Decimal> {
    const ws = await tx.warehouseStock.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
    });
    if (ws && toDecimal(ws.weightedAverageCost).gt(0)) {
      return toDecimal(ws.weightedAverageCost);
    }
    // Fall back to product-level WAC.
    return this.getCostBasisInTx(tx, productId);
  },

  /**
   * Get the current COGS basis for a product. Used by OrderService.create
   * when snapshotting OrderItem.unitCost. Prefers WAC; falls back to
   * purchasePrice for products seeded before WAC was implemented.
   */
  async getCostBasis(productId: string): Promise<Prisma.Decimal> {
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error(`Product not found: ${productId}`);
    const wac = toDecimal(product.weightedAverageCost);
    if (wac.gt(0)) return wac;
    // Back-compat: products seeded before WAC was added have wac=0 but
    // a non-zero purchasePrice. Use that as the cost basis.
    return toDecimal(product.purchasePrice);
  },

  /**
   * Same as getCostBasis but for use inside a transaction.
   */
  async getCostBasisInTx(tx: TxClient, productId: string): Promise<Prisma.Decimal> {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error(`Product not found: ${productId}`);
    const wac = toDecimal(product.weightedAverageCost);
    if (wac.gt(0)) return wac;
    return toDecimal(product.purchasePrice);
  },

  /**
   * Initialise WAC for all products that currently have wac=0 but a
   * non-zero purchasePrice. Used as a one-shot backfill when deploying
   * this feature to an existing database.
   *
   * For each affected product:
   *   weightedAverageCost = purchasePrice
   *
   * This is a safe approximation — it assumes the current purchasePrice
   * reflects the blended cost of the existing inventory. A more accurate
   * backfill would recompute WAC from the full purchase history, but that
   * is a heavier migration that requires a separate script.
   */
  async backfillWac(): Promise<{ updated: number }> {
    const products = await db.product.findMany({
      where: { weightedAverageCost: 0, purchasePrice: { gt: 0 } },
    });
    for (const p of products) {
      await db.product.update({
        where: { id: p.id },
        data: { weightedAverageCost: p.purchasePrice },
      });
    }
    return { updated: products.length };
  },
};
