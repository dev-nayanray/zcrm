import { NextRequest } from "next/server";
import { ok, serverError, notFound, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { MessageTemplateService } from "@/lib/services/message-template";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("message_templates:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<any>(request);
    const t = await MessageTemplateService.update(id, body ?? {});
    return ok({ ...t, variables: t.variables ? JSON.parse(t.variables) : [] });
  } catch (e) {
    return badRequest((e as Error).message);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("message_templates:delete");
    if (err) return err;
    const { id } = await ctx.params;
    await MessageTemplateService.del(id);
    return ok({ success: true });
  } catch (e) {
    return badRequest((e as Error).message);
  }
}
