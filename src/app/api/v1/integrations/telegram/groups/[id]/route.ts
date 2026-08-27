import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { TelegramService } from "@/lib/services/telegram";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("telegram:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<any>(request);
    return ok(await TelegramService.updateGroup(id, body ?? {}));
  } catch (e) { return badRequest((e as Error).message); }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("telegram:update");
    if (err) return err;
    const { id } = await ctx.params;
    await TelegramService.deleteGroup(id);
    return ok({ success: true });
  } catch (e) { return badRequest((e as Error).message); }
}
