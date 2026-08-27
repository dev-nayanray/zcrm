import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { SalesPipelineService } from "@/lib/services/sales-pipeline";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("pipelines:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const sp = request.nextUrl.searchParams;
    const res = await SalesPipelineService.list({ page: q.page, limit: q.limit, stage: sp.get("stage") || undefined, assignedToId: sp.get("assignedToId") || undefined, search: q.search });
    return ok({ items: res.items, total: res.total, page: q.page, limit: q.limit });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("pipelines:update");
    if (err) return err;
    const body = await readJsonBody<any>(request);
    if (!body?.customerId) return badRequest("customerId required");
    try { return ok(await SalesPipelineService.create(body)); }
    catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
