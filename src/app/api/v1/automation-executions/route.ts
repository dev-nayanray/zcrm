import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { AutomationService } from "@/lib/services/automation";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("audit_logs:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const res = await AutomationService.listExecutions({ page: q.page, limit: q.limit, status });
    return ok({ items: res.items, total: res.total, page: q.page, limit: q.limit });
  } catch (e) { return serverError((e as Error).message); }
}
