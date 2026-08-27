import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { BillingService } from "@/lib/services/billing";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("billing:manage_payouts" as any);
    if (err) return err;
    const { id } = await ctx.params;
    try { return ok(await BillingService.approvePayout(id)); }
    catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
