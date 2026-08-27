import { NextRequest } from "next/server";
import { ok, serverError, badRequest, notFound } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { AutomationService } from "@/lib/services/automation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("automation:read");
    if (err) return err;
    const { id } = await ctx.params;
    const rule = await AutomationService.getRule(id);
    if (!rule) return notFound("Automation rule not found");
    return ok(rule);
  } catch (e) { return serverError((e as Error).message); }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("automation:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<any>(request);
    return ok(await AutomationService.updateRule(id, body ?? {}));
  } catch (e) { return badRequest((e as Error).message); }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("automation:update");
    if (err) return err;
    const { id } = await ctx.params;
    await AutomationService.deleteRule(id);
    return ok({ success: true });
  } catch (e) { return badRequest((e as Error).message); }
}
