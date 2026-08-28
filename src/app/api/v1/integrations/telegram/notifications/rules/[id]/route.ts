import { NextRequest } from "next/server";
import { ok, serverError, notFound } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { TelegramService } from "@/lib/services/telegram";

// DELETE /api/v1/integrations/telegram/notifications/rules/[id]
//
// Delete a single Telegram notification rule. Previously the API could
// only list & upsert rules — deleting required a direct DB call. Now an
// admin can prune obsolete rules from the dashboard.
type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("telegram:update");
    if (err) return err;
    const { id } = await ctx.params;
    try {
      const result = await TelegramService.deleteNotificationRule(id);
      return ok(result);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("not found") || msg.includes("does not exist")) return notFound(msg);
      return serverError(msg);
    }
  } catch (e) {
    return serverError((e as Error).message);
  }
}
