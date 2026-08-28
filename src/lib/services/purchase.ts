import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal, addMoney, subMoney } from "@/lib/decimal";
import { InventoryService } from "./inventory";
import { getCurrentUser } from "@/lib/auth";
import { AuditService } from "./audit";
import { CostingService } from "./costing";

// PurchaseService — receiving a purchase increases stock via Stock Movement
// (never directly edits inventory.quantity) and recomputes the Weighted
// Average Cost (WAC) for each product so that subsequent orders snapshot
// the blended cost — not just the latest purchase price.
export const PurchaseService = {
  async create(input: {
    supplierId: string;
    warehouseId?: string;  // NEW Phase 7: optional warehouse to receive stock into
    discount?: Prisma.Decimal | number | string;
    shippingCost?: Prisma.Decimal | number | string;
    otherCost?: Prisma.Decimal | number | string;
    notes?: string;
    paidAmount?: Prisma.Decimal | number | string;
    items: { productId: string; quantity: Prisma.Decimal | number | string; unitCost?: Prisma.Decimal | number | string }[];
    receive?: boolean;
    createdBy?: string;
    externalId?: string;
  }) {
    return db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const createdBy = input.createdBy ?? user?.id;

      const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
      if (!supplier) throw new Error("Supplier not found");

      // Snapshot product data; update product.purchasePrice from latest cost.
      let subtotal = new Prisma.Decimal(0);
      const lineItems: { productId: string; quantity: Prisma.Decimal; unitCost: Prisma.Decimal; total: Prisma.Decimal }[] = [];
      for (const item of input.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error(`Product not found: ${item.productId}`);
        const qty = toDecimal(item.quantity);
        if (qty.lte(0)) throw new Error("Quantity must be positive");
        const unitCost = toDecimal(item.unitCost ?? product.purchasePrice);
        const lineTotal = qty.times(unitCost);
        subtotal = subtotal.add(lineTotal);
        lineItems.push({ productId: product.id, quantity: qty, unitCost, total: lineTotal });
      }

      const discount = toDecimal(input.discount ?? 0);
      const shippingCost = toDecimal(input.shippingCost ?? 0);
      const otherCost = toDecimal(input.otherCost ?? 0);
      const total = subtotal.minus(discount).plus(shippingCost).plus(otherCost);
      const paidAmount = toDecimal(input.paidAmount ?? 0);
      const dueAmount = subMoney(total, paidAmount);
      let paymentStatus = "UNPAID";
      if (paidAmount.gte(total) && total.gt(0)) paymentStatus = "PAID";
      else if (paidAmount.gt(0)) paymentStatus = "PARTIAL";

      const count = await tx.purchase.count();
      const purchaseNumber = `PUR-${String(count + 1001).padStart(6, "0")}`;

      const status = input.receive === false ? "PENDING" : "RECEIVED";

      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: supplier.id,
          warehouseId: input.warehouseId ?? null,
          status,
          // Schema stores Float — convert Decimals via toNumber().
          subtotal: subtotal.toNumber(),
          discount: discount.toNumber(),
          shippingCost: shippingCost.toNumber(),
          total: total.toNumber(),
          paidAmount: paidAmount.toNumber(),
          dueAmount: dueAmount.toNumber(),
          paymentStatus,
          notes: input.notes,
          createdBy,
          items: { create: lineItems.map((li) => ({
            productId: li.productId,
            quantity: li.quantity.toNumber(),
            unitCost: li.unitCost.toNumber(),
            total: li.total.toNumber(),
          })) },
        },
        include: { items: true },
      });

      // If received, increase stock via PURCHASE movement for each item (same tx),
      // then recompute the Weighted Average Cost so subsequent orders use the
      // blended cost basis instead of just the latest purchase price.
      if (input.receive !== false) {
        for (const li of lineItems) {
          await InventoryService.applyMovementInTx(tx, {
            productId: li.productId,
            type: "PURCHASE",
            quantityChange: li.quantity,
            referenceType: "PURCHASE",
            referenceId: purchase.id,
            reason: `Purchase ${purchaseNumber}`,
            createdBy,
            warehouseId: input.warehouseId ?? null,
          });
          // Recompute WAC AFTER the stock movement has been applied.
          // Phase 7: if a warehouseId was specified, recompute BOTH the
          // per-warehouse WAC (WarehouseStock.weightedAverageCost) AND the
          // product-level WAC (Product.weightedAverageCost). The product-level
          // WAC is kept as the aggregate cost basis for back-compat.
          if (input.warehouseId) {
            await CostingService.recomputeWarehouseWacInTx(tx, li.productId, input.warehouseId, li.quantity, li.unitCost);
          } else {
            await CostingService.recomputeWacInTx(tx, li.productId, li.quantity, li.unitCost);
          }
        }
        await AuditService.log({
          userId: createdBy,
          action: "PURCHASE_RECEIVE",
          entity: "Purchase",
          entityId: purchase.id,
          changes: { purchaseNumber, total: total.toFixed(2) },
        }, tx);
      }

      await AuditService.log({
        userId: createdBy,
        action: "PURCHASE_CREATE",
        entity: "Purchase",
        entityId: purchase.id,
        changes: { purchaseNumber, total: total.toFixed(2), status },
      }, tx);

      return tx.purchase.findUnique({
        where: { id: purchase.id },
        include: { items: { include: { product: { select: { name: true, sku: true } } } }, supplier: true },
      });
    }, { timeout: 20000, maxWait: 10000 });
  },

  // Receive a pending purchase (increase stock + recompute WAC).
  async receive(purchaseId: string) {
    return db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const purchase = await tx.purchase.findUnique({ where: { id: purchaseId }, include: { items: true } });
      if (!purchase) throw new Error("Purchase not found");
      if (purchase.status === "RECEIVED") throw new Error("Purchase already received");

      for (const it of purchase.items) {
        await InventoryService.applyMovementInTx(tx, {
          productId: it.productId,
          type: "PURCHASE",
          quantityChange: it.quantity,
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          reason: `Purchase ${purchase.purchaseNumber} received`,
          createdBy: user?.id,
        });
        // Recompute WAC after stock movement.
        await CostingService.recomputeWacInTx(tx, it.productId, it.quantity, it.unitCost);
      }
      const updated = await tx.purchase.update({ where: { id: purchaseId }, data: { status: "RECEIVED" } });
      await AuditService.log({
        userId: user?.id,
        action: "PURCHASE_RECEIVE",
        entity: "Purchase",
        entityId: purchaseId,
        changes: { purchaseNumber: purchase.purchaseNumber },
      }, tx);
      return updated;
    });
  },
};
