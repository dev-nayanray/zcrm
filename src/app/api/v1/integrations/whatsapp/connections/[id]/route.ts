import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { WhatsAppService } from "@/lib/services/whatsapp";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("integrations:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<any>(request);
    const res = await WhatsAppService.updateConnection(id, body ?? {});
    return ok({ id: res.id });
  } catch (e) {
    return badRequest((e as Error).message);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("integrations:update");
    if (err) return err;
    const { id } = await ctx.params;
    await WhatsAppService.deleteConnection(id);
    return ok({ success: true });
  } catch (e) {
    return badRequest((e as Error).message);
  }
}
