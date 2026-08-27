import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { stockAdjustmentSchema } from "@/lib/validation";
import { InventoryService } from "@/lib/services/inventory";
import { AuditService } from "@/lib/services/audit";
import { parsePagination } from "@/lib/query";
import { toDecimal } from "@/lib/decimal";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("inventory:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status"); // low | out | all
    const where: Prisma.ProductWhereInput = {};
    if (q.search) where.OR = [{ name: { contains: q.search } }, { sku: { contains: q.search } }];

    const products = await db.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: { inventory: true, category: { select: { name: true } } },
    });

    let items = products.map((p) => {
      const qty = toDecimal(p.inventory?.quantity ?? 0);
      const reserved = toDecimal(p.inventory?.reservedQuantity ?? 0);
      const damaged = toDecimal(p.inventory?.damagedQuantity ?? 0);
      const min = toDecimal(p.inventory?.minimumStock ?? p.minimumStockLevel);
      const reorder = toDecimal(p.inventory?.reorderLevel ?? p.minimumStockLevel);
      const available = qty.minus(reserved);
      let stockStatus = "HEALTHY";
      if (available.lte(0)) stockStatus = "OUT_OF_STOCK";
      else if (reorder.gt(0) && available.lte(reorder)) stockStatus = "LOW_STOCK";
      else if (min.gt(0) && available.lte(min)) stockStatus = "LOW_STOCK";
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category?.name,
        quantity: qty.toFixed(3),
        reservedQuantity: reserved.toFixed(3),
        damagedQuantity: damaged.toFixed(3),
        availableQuantity: available.toFixed(3),
        minimumStockLevel: min.toFixed(0),
        reorderLevel: reorder.toFixed(0),
        purchasePrice: p.purchasePrice.toFixed(2),
        sellingPrice: p.sellingPrice.toFixed(2),
        status: p.status,
        stockStatus,
        stockValue: qty.times(p.purchasePrice).toFixed(2),
        retailValue: qty.times(p.sellingPrice).toFixed(2),
      };
    });
    if (status === "low") items = items.filter((i) => i.stockStatus === "LOW_STOCK");
    if (status === "out") items = items.filter((i) => i.stockStatus === "OUT_OF_STOCK");

    const total = await db.product.count({ where });
    return ok({ items, total, page: q.page, limit: q.limit });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("inventory:adjust");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = stockAdjustmentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    try {
      const allowNegativeSetting = await db.setting.findUnique({ where: { key: "allowNegativeStock" } });
      const allowNegative = allowNegativeSetting?.value === "true";
      const result = await InventoryService.applyMovement(
        {
          productId: parsed.data.productId,
          type: parsed.data.type,
          quantityChange: parsed.data.quantityChange,
          reason: parsed.data.reason,
          referenceType: "MANUAL",
          createdBy: user!.id,
        },
        { allowNegative },
      );
      await AuditService.log({ userId: user!.id, action: "STOCK_ADJUST", entity: "Product", entityId: parsed.data.productId, changes: parsed.data });
      return ok({
        movement: { ...result.movement, quantityChange: result.movement.quantityChange.toFixed(3), previousQuantity: result.movement.previousQuantity.toFixed(3), newQuantity: result.movement.newQuantity.toFixed(3) },
        inventory: { ...result.inventory, quantity: result.inventory.quantity.toFixed(3), damagedQuantity: result.inventory.damagedQuantity.toFixed(3) },
      });
    } catch (e) {
      return badRequest((e as Error).message);
    }
  } catch (e) {
    return serverError((e as Error).message);
  }
}
