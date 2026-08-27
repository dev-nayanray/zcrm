import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { TelegramService } from "@/lib/services/telegram";
import { AuditService } from "@/lib/services/audit";

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("telegram:read");
    if (err) return err;
    return ok(await TelegramService.getStatus());
  } catch (e) { return serverError((e as Error).message); }
}

export async function PUT(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("telegram:update");
    if (err) return err;
    const body = await readJsonBody<any>(request);
    // only update provided fields — merge with existing
    const update: any = {};
    if (body.botToken) update.botToken = body.botToken;
    if (body.botUsername !== undefined) update.botUsername = body.botUsername;
    if (body.webhookUrl !== undefined) update.webhookUrl = body.webhookUrl;
    if (body.webhookSecret !== undefined) {
      if (body.webhookSecret && !/^[A-Za-z0-9_-]{1,256}$/.test(body.webhookSecret)) {
        return badRequest("Webhook Secret can only contain letters, numbers, underscores (_) and hyphens (-), 1-256 characters.");
      }
      update.webhookSecret = body.webhookSecret;
    }
    if (body.defaultLanguage !== undefined) update.defaultLanguage = body.defaultLanguage;
    await TelegramService.saveConfig(update);
    await AuditService.log({ userId: user!.id, action: "TELEGRAM_CONFIG", entity: "TelegramBot", entityId: "telegram", changes: { fields: Object.keys(update) } });
    return ok({ success: true });
  } catch (e) { return badRequest((e as Error).message); }
}

// POST: Set webhook on Telegram API (tells Telegram where to send updates)
export async function POST(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("telegram:update");
    if (err) return err;
    const body = await readJsonBody<{ action?: string; url?: string }>(request);

    if (body?.action === "setWebhook" || body?.url) {
      // NOTE: previously fell back to a hardcoded dev-preview domain
      // (space-z.ai) when no url was supplied. That silently pointed
      // Telegram's webhook at a domain the deployment doesn't own,
      // which is why updates never arrived. The caller (frontend) always
      // sends window.location.origin, so require an explicit URL here and
      // fail loudly instead of guessing a domain.
      const url = body.url;
      if (!url || typeof url !== "string" || !/^https:\/\//.test(url)) {
        return badRequest("A valid https:// webhook URL is required.");
      }
      try {
        const result = await TelegramService.setWebhook(url);
        return ok({ success: true, webhookUrl: url, result });
      } catch (e) {
        return badRequest((e as Error).message);
      }
    }

    if (body?.action === "getWebhookInfo") {
      const cfg = await TelegramService.getConfig();
      if (!cfg?.botToken || cfg.botToken === "PLACEHOLDER_BOT_TOKEN_REPLACE_WITH_REAL_TELEGRAM_BOT_TOKEN") {
        return badRequest("Bot token not configured");
      }
      try {
        const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/getWebhookInfo`);
        const data = await res.json();
        return ok(data);
      } catch (e) {
        return badRequest((e as Error).message);
      }
    }

    return badRequest("Unknown action. Use {action:'setWebhook'} or {action:'getWebhookInfo'}");
  } catch (e) { return badRequest((e as Error).message); }
}
