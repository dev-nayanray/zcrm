import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { SalesPipelineService } from "@/lib/services/sales-pipeline";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("pipelines:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<{ stage?: string; notes?: string }>(request);
    if (body?.stage) return ok(await SalesPipelineService.updateStage(id, body.stage, body.notes));
    return ok({ success: true });
  } catch (e) { return badRequest((e as Error).message); }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("pipelines:update");
    if (err) return err;
    const { id } = await ctx.params;
    await SalesPipelineService.del(id);
    return ok({ success: true });
  } catch (e) { return badRequest((e as Error).message); }
}
