import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { LeadService } from "@/lib/services/lead";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("leads:update");
    if (err) return err;
    const { id } = await ctx.params;
    try { return ok({ customerId: await LeadService.convertToCustomer(id) }); }
    catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
