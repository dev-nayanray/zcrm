import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { WebhookService } from "@/lib/services/webhook";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("webhook_events:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const provider = request.nextUrl.searchParams.get("provider") || undefined;
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const res = await WebhookService.list({ page: q.page, limit: q.limit, provider, status });
    return ok({ items: res.items, total: res.total, page: q.page, limit: q.limit });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
