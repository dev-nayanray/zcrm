import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { TelegramService } from "@/lib/services/telegram";

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("telegram:update" as any);
    if (err) return err;
    const body = await request.json().catch(() => ({}));
    // Require an explicit URL — do not fall back to a hardcoded dev domain
    // that the deployment does not own (that was the bug: webhooks were
    // silently registered against a domain that could never receive them).
    const url = typeof body?.url === "string" ? body.url : undefined;
    if (!url || !/^https:\/\//.test(url)) {
      return badRequest("A valid https:// webhook URL is required.");
    }
    try {
      const result = await TelegramService.setWebhook(url);
      return ok({ success: true, webhookUrl: url, result });
    } catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
