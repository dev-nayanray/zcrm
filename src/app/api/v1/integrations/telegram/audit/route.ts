import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { TelegramService } from "@/lib/services/telegram";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("telegram:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const groupId = request.nextUrl.searchParams.get("groupId") || undefined;
    const action = request.nextUrl.searchParams.get("action") || undefined;
    const res = await TelegramService.listAuditLogs({ page: q.page, limit: q.limit, groupId, action });
    return ok({ items: res.items, total: res.total, page: q.page, limit: q.limit });
  } catch (e) { return serverError((e as Error).message); }
}
