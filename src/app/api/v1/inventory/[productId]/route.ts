import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { InventoryService } from "@/lib/services/inventory";
import { parsePagination } from "@/lib/query";

type Ctx = { params: Promise<{ productId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("inventory:read");
    if (err) return err;
    const { productId } = await ctx.params;
    const q = parsePagination(request.nextUrl.searchParams);
    const { items, total } = await InventoryService.movements(productId, { page: q.page, limit: q.limit });
    return ok({
      items: items.map((m) => ({
        ...m,
        quantityChange: m.quantityChange.toFixed(3),
        previousQuantity: m.previousQuantity.toFixed(3),
        newQuantity: m.newQuantity.toFixed(3),
      })),
      total,
      page: q.page,
      limit: q.limit,
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
