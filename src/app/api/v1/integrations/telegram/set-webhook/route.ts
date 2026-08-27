import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { TelegramService } from "@/lib/services/telegram";

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("telegram:update" as any);
    if (err) return err;
    const body = await request.json().catch(() => ({}));
    const url = body?.url || `https://e1k4y76az460-d.space-z.ai/api/v1/integrations/telegram/webhook`;
    try {
      const result = await TelegramService.setWebhook(url);
      return ok({ success: true, webhookUrl: url, result });
    } catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
