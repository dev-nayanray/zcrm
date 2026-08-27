import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { resolveRange } from "@/lib/date-range";
import { InventoryService } from "@/lib/services/inventory";
import { toDecimal } from "@/lib/decimal";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("reports:read");
    if (err) return err;
    const sp = request.nextUrl.searchParams;
    const range = resolveRange(sp.get("preset") || undefined, sp.get("from") || undefined, sp.get("to") || undefined);

    const valuation = await InventoryService.stockValue();
    const allInv = await db.inventory.findMany({
      include: { product: { select: { name: true, sku: true, minimumStockLevel: true, status: true, purchasePrice: true, sellingPrice: true } } },
    });
    const lowStock = allInv.filter((i) => {
      const qty = new Prisma.Decimal(i.quantity);
      const min = new Prisma.Decimal(i.product.minimumStockLevel);
      return qty.gt(0) && qty.lte(min);
    });
    const outOfStock = allInv.filter((i) => new Prisma.Decimal(i.quantity).lte(0));

    // Movements in range
    const rangeCreatedAt: Record<string, Date> = {};
    if (range.from) rangeCreatedAt.gte = range.from;
    if (range.to) rangeCreatedAt.lte = range.to;
    const movements = await db.stockMovement.findMany({
      where: Object.keys(rangeCreatedAt).length ? { createdAt: rangeCreatedAt } : {},
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { product: { select: { name: true, sku: true } }, creator: { select: { name: true } } },
    });

    const byType: Record<string, number> = {};
    for (const m of movements) {
      byType[m.type] = (byType[m.type] ?? 0) + 1;
    }

    return ok({
      totalCostValue: valuation.totalCost,
      totalRetailValue: valuation.totalRetail,
      itemCount: valuation.items.length,
      items: valuation.items,
      lowStock: lowStock.map((i) => ({ productId: i.productId, name: i.product.name, sku: i.product.sku, quantity: i.quantity.toFixed(0), minimum: i.product.minimumStockLevel.toFixed(0) })),
      outOfStock: outOfStock.map((i) => ({ productId: i.productId, name: i.product.name, sku: i.product.sku })),
      movements: movements.map((m) => ({
        id: m.id,
        type: m.type,
        product: m.product,
        quantityChange: m.quantityChange.toFixed(3),
        previousQuantity: m.previousQuantity.toFixed(3),
        newQuantity: m.newQuantity.toFixed(3),
        reason: m.reason,
        referenceType: m.referenceType,
        createdBy: m.creator?.name,
        createdAt: m.createdAt,
      })),
      movementsByType: byType,
      range: { from: range.from?.toISOString(), to: range.to?.toISOString() },
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

void toDecimal;
