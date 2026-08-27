import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { CustomerDueService } from "@/lib/services/customer-due";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("reports:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const sp = request.nextUrl.searchParams;
    const res = await CustomerDueService.list({ page: q.page, limit: q.limit, search: q.search, status: sp.get("status") || "DUE", minDue: sp.get("minDue") ? Number(sp.get("minDue")) : undefined, from: sp.get("from") ? new Date(sp.get("from")!) : undefined, to: sp.get("to") ? new Date(sp.get("to")!) : undefined });
    return ok({ items: res.items, total: res.total, page: q.page, limit: q.limit });
  } catch (e) { return serverError((e as Error).message); }
}
