import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { MetaService } from "@/lib/services/meta";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("leads:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const res = await MetaService.listLeads({ page: q.page, limit: q.limit, status, search: q.search });
    return ok(res);
  } catch (e) {
    return serverError((e as Error).message);
  }
}
