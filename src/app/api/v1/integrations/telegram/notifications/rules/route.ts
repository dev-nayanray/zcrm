import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { TelegramService } from "@/lib/services/telegram";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("telegram:read");
    if (err) return err;
    const groupId = request.nextUrl.searchParams.get("groupId") || undefined;
    return ok({ items: await TelegramService.listNotificationRules(groupId) });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("telegram:update");
    if (err) return err;
    const body = await readJsonBody<{ groupId: string; eventType: string; isActive?: boolean; language?: string }>(request);
    if (!body?.groupId || !body?.eventType) return badRequest("groupId and eventType required");
    return ok(await TelegramService.upsertNotificationRule(body.groupId, body.eventType, body.isActive ?? true, body.language ?? "en"));
  } catch (e) { return badRequest((e as Error).message); }
}
