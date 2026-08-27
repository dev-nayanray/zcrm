import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { LeadService } from "@/lib/services/lead";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("leads:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const sp = request.nextUrl.searchParams;
    const status = sp.get("status") || undefined;
    const stage = sp.get("stage") || undefined;
    const assignedToId = sp.get("assignedToId") || undefined;
    const res = await LeadService.list({ page: q.page, limit: q.limit, status, stage, assignedToId, search: q.search });
    return ok({ items: res.items, total: res.total, page: q.page, limit: q.limit });
  } catch (e) { return serverError((e as Error).message); }
}
