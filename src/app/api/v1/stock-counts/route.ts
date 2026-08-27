import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { StockReconciliationService } from "@/lib/services/stock-reconciliation";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("stock_counts:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const res = await StockReconciliationService.list({ page: q.page, limit: q.limit, status });
    return ok({ items: res.items, total: res.total, page: q.page, limit: q.limit });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("inventory:adjust");
    if (err) return err;
    const body = await readJsonBody<any>(request);
    try { return ok(await StockReconciliationService.create(body ?? {})); }
    catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
