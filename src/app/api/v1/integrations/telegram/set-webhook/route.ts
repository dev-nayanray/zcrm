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
    // Same fix as /config: persist a supplied secret before registering it
    // with Telegram, so the DB and Telegram's secret_token can never drift
    // apart (a mismatch here silently drops every incoming update).
    if (typeof body?.secret === "string" && body.secret) {
      if (!/^[A-Za-z0-9_-]{1,256}$/.test(body.secret)) {
        return badRequest("Webhook Secret can only contain letters, numbers, underscores (_) and hyphens (-), 1-256 characters.");
      }
      await TelegramService.saveConfig({ webhookSecret: body.secret });
    }
    try {
      const result = await TelegramService.setWebhook(url);
      return ok({ success: true, webhookUrl: url, result });
    } catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
