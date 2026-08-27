import { NextRequest } from "next/server";
import { ok, serverError, notFound } from "@/lib/api";
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

type Ctx = { params: Promise<{ id: string }> };

// PATCH — mark a single notification as read. Scoped by the current user's
// id: a user can only mark their OWN notifications (or broadcasts) as read.
// Previously any authenticated user could mark ANY other user's notification
// as read by id (IDOR).
export async function PATCH(_request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("notifications:read");
    if (err) return err;
    const { id } = await ctx.params;
    const updated = await NotificationService.markRead(id, user!.id);
    if (!updated) return notFound("Notification not found");
    return ok(updated);
  } catch (e) {
    return serverError((e as Error).message);
  }
}

// DELETE — delete a single notification. Same scoping as PATCH. Previously
// this was a no-op that returned `{ success: true }` without deleting —
// the UI may have shown "deleted" but the row persisted.
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("notifications:read");
    if (err) return err;
    const { id } = await ctx.params;
    const deleted = await NotificationService.delete(id, user!.id);
    if (!deleted) return notFound("Notification not found");
    return ok({ success: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
