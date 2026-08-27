import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { TelegramService } from "@/lib/services/telegram";

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("telegram:read");
    if (err) return err;
    return ok({ items: await TelegramService.listUsers() });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("telegram:update");
    if (err) return err;
    const body = await readJsonBody<{ groupId: string; telegramId: string; roleName: string }>(request);
    if (!body?.groupId || !body?.telegramId || !body?.roleName) return badRequest("groupId, telegramId and roleName required");
    await TelegramService.assignMembership(body.groupId, body.telegramId, body.roleName);
    return ok({ success: true });
  } catch (e) { return badRequest((e as Error).message); }
}
