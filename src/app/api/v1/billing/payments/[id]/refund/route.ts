import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { BillingService } from "@/lib/services/billing";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("billing:refund" as any);
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<{ reason: string }>(request);
    try {
      return ok(await BillingService.refundPayment(id, body?.reason || ""));
    } catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
