import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { InventoryService } from "@/lib/services/inventory";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("inventory:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const productId = request.nextUrl.searchParams.get("productId") || undefined;
    const type = request.nextUrl.searchParams.get("type") || undefined;
    const createdBy = request.nextUrl.searchParams.get("createdBy") || undefined;
    const referenceType = request.nextUrl.searchParams.get("referenceType") || undefined;
    const referenceId = request.nextUrl.searchParams.get("referenceId") || undefined;
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const res = await InventoryService.allMovements({
      page: q.page, limit: q.limit, productId, type, createdBy, referenceType, referenceId,
      from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined,
    });
    return ok({
      items: res.items.map((m: any) => ({
        ...m,
        quantityChange: m.quantityChange.toFixed(3),
        previousQuantity: m.previousQuantity.toFixed(3),
        newQuantity: m.newQuantity.toFixed(3),
      })),
      total: res.total, page: q.page, limit: q.limit,
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
