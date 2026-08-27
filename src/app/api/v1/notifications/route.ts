import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { NotificationService } from "@/lib/services/notification";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("notifications:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const unreadOnly = request.nextUrl.searchParams.get("unreadOnly") === "true";
    const { items, total } = await NotificationService.listForUser(user!.id, { page: q.page, limit: q.limit, unreadOnly });
    return ok({ items, total, page: q.page, limit: q.limit });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function PATCH(_request: NextRequest) {
  // mark all read for current user
  try {
    const [user, err] = await requirePermission("notifications:read");
    if (err) return err;
    await NotificationService.markAllRead(user!.id);
    return ok({ success: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
