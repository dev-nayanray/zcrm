import { NextRequest } from "next/server";
import { ok, serverError, notFound, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { LeadService } from "@/lib/services/lead";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("leads:read");
    if (err) return err;
    const { id } = await ctx.params;
    const lead = await LeadService.get(id);
    if (!lead) return notFound("Lead not found");
    return ok(lead);
  } catch (e) { return serverError((e as Error).message); }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("leads:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<{ status?: string; notes?: string; customerId?: string; assignedToId?: string; pipelineStage?: string; followUpDate?: string }>(request);
    // If assignment / pipeline changes, use LeadService.assign
    if (body.assignedToId || body.pipelineStage || body.followUpDate) {
      await LeadService.assign(id, { assignedToId: body.assignedToId, pipelineStage: body.pipelineStage, followUpDate: body.followUpDate ? new Date(body.followUpDate) : undefined, notes: body.notes });
    }
    if (body.status || body.notes !== undefined || body.customerId !== undefined) {
      await db.metaLead.update({ where: { id }, data: { status: body.status, notes: body.notes, customerId: body.customerId } });
    }
    return ok(await LeadService.get(id));
  } catch (e) { return badRequest((e as Error).message); }
}
