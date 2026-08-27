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
    const body = await readJsonBody<{ action?: string; url?: string; secret?: string }>(request);

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
      // BUGFIX: this endpoint used to call TelegramService.setWebhook(url),
      // which registers Telegram's secret_token from whatever webhookSecret
      // is CURRENTLY IN THE DB. The frontend's "Generate" button only fills
      // a local form field — it never reached the DB unless the admin
      // separately clicked "Save Configuration" *first*. Any admin who
      // generated a secret and went straight to "Set Webhook" (the natural
      // reading of the two buttons) ended up with Telegram registered
      // against a secret that didn't match the DB (or no secret at all),
      // so every single incoming update — /start, group commands, 2FA
      // codes, everything — failed the secret check and was silently
      // dropped. Now: if the caller supplies `secret`, persist it FIRST so
      // the DB and Telegram are always set atomically from the same value.
      if (body.secret !== undefined) {
        if (body.secret && !/^[A-Za-z0-9_-]{1,256}$/.test(body.secret)) {
          return badRequest("Webhook Secret can only contain letters, numbers, underscores (_) and hyphens (-), 1-256 characters.");
        }
        await TelegramService.saveConfig({ webhookSecret: body.secret });
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
