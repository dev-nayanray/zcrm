import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";
import { InventoryService } from "./inventory";
import { getCurrentUser } from "@/lib/auth";
import { AuditService } from "./audit";

// StockReconciliationService — physical stock counts with an approval workflow.
// Flow: create a StockCount (DRAFT) → add items with systemQuantity (auto) +
// countedQuantity (manual) → submit for approval (PENDING_APPROVAL) → approve
// (APPROVED) which applies ADJUSTMENT movements via InventoryService (no bypass).
export const StockReconciliationService = {
  async list(opts: { page: number; limit: number; status?: string }) {
    const where: Prisma.StockCountWhereInput = {};
    if (opts.status) where.status = opts.status;
    const [items, total] = await Promise.all([
      db.stockCount.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        include: { warehouse: { select: { id: true, name: true } }, creator: { select: { name: true } }, approver: { select: { name: true } }, _count: { select: { items: true } } },
      }),
      db.stockCount.count({ where }),
    ]);
    return { items, total };
  },

  async get(id: string) {
    return db.stockCount.findUnique({ where: { id }, include: { warehouse: true, items: { include: { product: { select: { name: true, sku: true } } } }, creator: { select: { name: true } }, approver: { select: { name: true } } } });
  },

  async create(data: { warehouseId?: string; notes?: string; items?: { productId: string; countedQuantity: number | string }[] }) {
    const user = await getCurrentUser();
    const count = await db.stockCount.count();
    const countNumber = `SC-${String(count + 1001).padStart(6, "0")}`;
    // snapshot current system quantities
    const stockCount = await db.stockCount.create({
      data: {
        countNumber,
        warehouseId: data.warehouseId,
        status: "DRAFT",
        notes: data.notes,
        createdBy: user?.id,
        items: data.items?.length ? {
          create: await Promise.all(data.items.map(async (it) => {
            const inv = await db.inventory.findUnique({ where: { productId: it.productId } });
            const sys = toDecimal(inv?.quantity ?? 0);
            const counted = toDecimal(it.countedQuantity);
            return { productId: it.productId, systemQuantity: sys, countedQuantity: counted, difference: counted.minus(sys) };
          })),
        } : undefined,
      },
      include: { items: true },
    });
    await AuditService.log({ userId: user?.id, action: "STOCK_COUNT_CREATE", entity: "StockCount", entityId: stockCount.id, changes: { countNumber } });
    return stockCount;
  },

  async addItem(stockCountId: string, productId: string, countedQuantity: number | string) {
    const inv = await db.inventory.findUnique({ where: { productId } });
    const sys = toDecimal(inv?.quantity ?? 0);
    const counted = toDecimal(countedQuantity);
    return db.stockCountItem.upsert({
      where: { stockCountId_productId: { stockCountId, productId } },
      create: { stockCountId, productId, systemQuantity: sys, countedQuantity: counted, difference: counted.minus(sys) },
      update: { countedQuantity: counted, difference: counted.minus(sys) },
    });
  },

  async submit(stockCountId: string) {
    return db.stockCount.update({ where: { id: stockCountId }, data: { status: "PENDING_APPROVAL" } });
  },

  // Approve → apply ADJUSTMENT movements for every difference. Goes through
  // InventoryService so the ledger stays the single source of truth.
  async approve(stockCountId: string) {
    return db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const sc = await tx.stockCount.findUnique({ where: { id: stockCountId }, include: { items: true } });
      if (!sc) throw new Error("Stock count not found");
      if (sc.status !== "PENDING_APPROVAL") throw new Error("Only pending-approval counts can be approved");

      for (const item of sc.items) {
        const diff = toDecimal(item.difference);
        if (diff.isZero()) continue;
        // apply an ADJUSTMENT movement = the difference (signed)
        await InventoryService.applyMovementInTx(tx, {
          productId: item.productId,
          type: "ADJUSTMENT",
          quantityChange: diff,
          referenceType: "STOCK_COUNT",
          referenceId: sc.id,
          reason: `Stock count ${sc.countNumber} adjustment (${diff.toFixed(0)})`,
          createdBy: user?.id,
        });
      }
      const updated = await tx.stockCount.update({ where: { id: stockCountId }, data: { status: "APPROVED", approvedBy: user?.id, approvedAt: new Date() } });
      await AuditService.log({ userId: user?.id, action: "STOCK_COUNT_APPROVE", entity: "StockCount", entityId: stockCountId, changes: { items: sc.items.length } }, tx);
      return updated;
    }, { timeout: 30000, maxWait: 10000 });
  },

  async reject(stockCountId: string) {
    return db.stockCount.update({ where: { id: stockCountId }, data: { status: "REJECTED" } });
  },
};
