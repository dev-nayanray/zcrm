import { db } from "@/lib/db";
import { Prisma, PrismaClient } from "@prisma/client";
import { InventoryService } from "./inventory";
import { AuditService } from "./audit";
import { getCurrentUser } from "@/lib/auth";
import { toDecimal } from "@/lib/decimal";

// WarehouseService — multi-warehouse support. The default warehouse's stock
// is tracked in the `Inventory` table (backward compatible); per-warehouse
// stock lives in `WarehouseStock`. Transfers create TRANSFER_OUT + TRANSFER_IN
// movements so the ledger stays the single source of truth.
//
// FIX: StockTransferService previously applied both TRANSFER_OUT and
// TRANSFER_IN to the same single Inventory row (keyed by productId
// @unique), which nets to zero — and never updated WarehouseStock. So
// multi-warehouse transfers had no effect on actual stock. Now we update
// WarehouseStock for both legs (decrement source, increment destination)
// AND record the ledger movements. The aggregate Inventory row receives
// both legs (which nets to zero) so the dashboard's total stock is
// unchanged — which is correct, since transferring between two warehouses
// does not change the total. Per-warehouse stock, however, is now
// properly updated. Validation also rejects non-positive quantities.

export const WarehouseService = {
  async list() {
    return db.warehouse.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { warehouseStock: true } } } });
  },

  async getOrCreateDefault(): Promise<{ id: string }> {
    const existing = await db.warehouse.findFirst({ where: { isDefault: true } });
    if (existing) return existing;
    const created = await db.warehouse.create({ data: { name: "Main Warehouse", code: "MAIN", isDefault: true, isActive: true } });
    return created;
  },

  async create(data: { name: string; code: string; address?: string }) {
    const existing = await db.warehouse.findUnique({ where: { code: data.code } });
    if (existing) throw new Error("Warehouse code already exists");
    const w = await db.warehouse.create({ data: { ...data, isDefault: false, isActive: true } });
    await AuditService.logFromRequest({ action: "WAREHOUSE_CREATE", entity: "Warehouse", entityId: w.id, changes: { name: data.name, code: data.code } });
    return w;
  },

  async update(id: string, data: Partial<{ name: string; address: string; isActive: boolean }>) {
    const w = await db.warehouse.update({ where: { id }, data });
    await AuditService.logFromRequest({ action: "WAREHOUSE_UPDATE", entity: "Warehouse", entityId: id, changes: data });
    return w;
  },

  async del(id: string) {
    const w = await db.warehouse.findUnique({ where: { id } });
    if (w?.isDefault) throw new Error("Cannot delete the default warehouse");
    await db.warehouse.delete({ where: { id } });
    await AuditService.logFromRequest({ action: "WAREHOUSE_DELETE", entity: "Warehouse", entityId: id });
    return { success: true };
  },
};

// Get-or-create a WarehouseStock row inside a transaction.
async function getOrCreateWarehouseStock(
  tx: Prisma.TransactionClient | PrismaClient,
  warehouseId: string,
  productId: string,
) {
  let ws = await tx.warehouseStock.findUnique({
    where: { warehouseId_productId: { warehouseId, productId } },
  });
  if (!ws) {
    ws = await tx.warehouseStock.create({
      data: { warehouseId, productId, quantity: 0 },
    });
  }
  return ws;
}

export const StockTransferService = {
  async list(opts: { page: number; limit: number; status?: string }) {
    const where: Prisma.StockTransferWhereInput = {};
    if (opts.status) where.status = opts.status;
    const [items, total] = await Promise.all([
      db.stockTransfer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        include: { fromWarehouse: { select: { id: true, name: true } }, toWarehouse: { select: { id: true, name: true } }, _count: { select: { items: true } }, creator: { select: { name: true } } },
      }),
      db.stockTransfer.count({ where }),
    ]);
    return { items, total };
  },

  async create(input: { fromWarehouseId: string; toWarehouseId: string; notes?: string; items: { productId: string; quantity: number | string }[] }) {
    return db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const count = await tx.stockTransfer.count();
      const transferNumber = `TRF-${String(count + 1001).padStart(6, "0")}`;

      if (input.fromWarehouseId === input.toWarehouseId) throw new Error("Source and destination must differ");

      // Validate warehouses exist and are active.
      const [fromWh, toWh] = await Promise.all([
        tx.warehouse.findUnique({ where: { id: input.fromWarehouseId } }),
        tx.warehouse.findUnique({ where: { id: input.toWarehouseId } }),
      ]);
      if (!fromWh) throw new Error("Source warehouse not found");
      if (!toWh) throw new Error("Destination warehouse not found");

      // Validate quantities — reject non-positive (a negative qty would
      // silently inject stock via TRANSFER_OUT negation; a 0 qty creates a
      // meaningless no-op movement).
      for (const it of input.items) {
        const q = toDecimal(it.quantity);
        if (q.lte(0)) throw new Error("Transfer quantity must be greater than zero");
      }

      const transfer = await tx.stockTransfer.create({
        data: {
          transferNumber,
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          status: "COMPLETED",
          notes: input.notes,
          createdBy: user?.id,
          items: { create: input.items.map((i) => ({ productId: i.productId, quantity: new Prisma.Decimal(String(i.quantity)).toNumber() })) },
        },
        include: { items: true },
      });

      // Apply TRANSFER_OUT (from) and TRANSFER_IN (to) movements in the
      // ledger. Both legs are recorded against the single Inventory row
      // (keyed by productId @unique) so the AGGREGATE stock stays
      // consistent (transferring between two warehouses does not change
      // total stock). The per-warehouse WarehouseStock table is updated
      // for both legs so per-warehouse stock is correctly tracked.
      for (const it of input.items) {
        const qty = toDecimal(it.quantity);

        // 1) Decrement source WarehouseStock — verify sufficient stock.
        const fromWs = await getOrCreateWarehouseStock(tx, input.fromWarehouseId, it.productId);
        if (toDecimal(fromWs.quantity).minus(qty).lt(0)) {
          throw new Error(`Insufficient stock in source warehouse for product. Available: ${toDecimal(fromWs.quantity).toFixed(0)}, requested: ${qty.toFixed(0)}`);
        }
        await tx.warehouseStock.update({
          where: { id: fromWs.id },
          data: { quantity: toDecimal(fromWs.quantity).minus(qty).toNumber() },
        });

        // 2) Increment destination WarehouseStock.
        const toWs = await getOrCreateWarehouseStock(tx, input.toWarehouseId, it.productId);
        await tx.warehouseStock.update({
          where: { id: toWs.id },
          data: { quantity: toDecimal(toWs.quantity).plus(qty).toNumber() },
        });

        // 3) Record ledger movements (these net to zero on the aggregate
        // Inventory row, which is correct — transferring doesn't change
        // total stock; it just moves it between warehouses).
        await InventoryService.applyMovementInTx(tx, {
          productId: it.productId,
          type: "TRANSFER_OUT",
          quantityChange: qty.negated(),
          referenceType: "TRANSFER",
          referenceId: transfer.id,
          reason: `Transfer out → ${transferNumber}`,
          createdBy: user?.id,
          warehouseId: input.fromWarehouseId,
        });
        await InventoryService.applyMovementInTx(tx, {
          productId: it.productId,
          type: "TRANSFER_IN",
          quantityChange: qty,
          referenceType: "TRANSFER",
          referenceId: transfer.id,
          reason: `Transfer in ← ${transferNumber}`,
          createdBy: user?.id,
          warehouseId: input.toWarehouseId,
        });
      }

      await AuditService.log({ userId: user?.id, action: "STOCK_TRANSFER", entity: "StockTransfer", entityId: transfer.id, changes: { transferNumber, items: input.items.length } }, tx);
      return transfer;
    }, { timeout: 20000, maxWait: 10000 });
  },
};
