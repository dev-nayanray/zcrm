import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { TelegramService } from "@/lib/services/telegram";
import { db } from "@/lib/db";

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("telegram:read");
    if (err) return err;
    return ok({ items: await TelegramService.listGroups() });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("telegram:update");
    if (err) return err;
    const body = await readJsonBody<{ chatId: string; chatTitle: string; roleName?: string; isActive?: boolean; welcomeText?: string }>(request);
    if (!body?.chatId || !body?.chatTitle) return badRequest("chatId and chatTitle required");
    const bot = await db.telegramBot.findFirst();
    if (!bot) return badRequest("No Telegram bot configured");
    return ok(await TelegramService.upsertGroup(body.chatId, { chatTitle: body.chatTitle, roleName: body.roleName, isActive: body.isActive, welcomeText: body.welcomeText, botId: bot.id }));
  } catch (e) { return badRequest((e as Error).message); }
}
