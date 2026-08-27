import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { InventoryService } from "@/lib/services/inventory";

// Inventory dashboard: total products, stock units, value, reserved/damaged,
// low/out of stock, stock-in/out today, movement summary.
export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("inventory:read");
    if (err) return err;
    const valuation = await InventoryService.stockValue();
    const summary = await InventoryService.movementSummaryToday();
    const lowStock = valuation.items.filter((i) => i.stockStatus === "LOW_STOCK");
    const outOfStock = valuation.items.filter((i) => i.stockStatus === "OUT_OF_STOCK");
    const damaged = valuation.items.filter((i) => Number(i.damagedQuantity) > 0);
    return ok({
      totalProducts: valuation.items.length,
      totalUnits: valuation.totalUnits,
      totalReserved: valuation.totalReserved,
      totalDamaged: valuation.totalDamaged,
      totalAvailable: valuation.totalAvailable,
      totalCostValue: valuation.totalCost,
      totalRetailValue: valuation.totalRetail,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      damagedCount: damaged.length,
      lowStock,
      outOfStock,
      damaged,
      movementSummary: summary,
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
