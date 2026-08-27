import { NextRequest } from "next/server";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { StockTransferService } from "@/lib/services/warehouse";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("stock_transfers:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const res = await StockTransferService.list({ page: q.page, limit: q.limit, status });
    return ok({ items: res.items.map((t: any) => ({ ...t, })), total: res.total, page: q.page, limit: q.limit });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("stock_transfers:create");
    if (err) return err;
    const body = await readJsonBody<{ fromWarehouseId: string; toWarehouseId: string; notes?: string; items: { productId: string; quantity: string | number }[] }>(request);
    if (!body?.fromWarehouseId || !body?.toWarehouseId || !body?.items?.length) return badRequest("fromWarehouseId, toWarehouseId and items required");
    try {
      const transfer = await StockTransferService.create({
        fromWarehouseId: body.fromWarehouseId,
        toWarehouseId: body.toWarehouseId,
        notes: body.notes,
        items: body.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      return ok(transfer);
    } catch (e) {
      return badRequest((e as Error).message);
    }
  } catch (e) {
    return serverError((e as Error).message);
  }
}

void validationError;
