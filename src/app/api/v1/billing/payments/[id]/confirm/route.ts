import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { BillingService } from "@/lib/services/billing";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("billing:verify" as any);
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<{ transactionId?: string; notes?: string }>(request);
    try {
      return ok(await BillingService.confirmPayment(id, user!.id, body?.transactionId, body?.notes));
    } catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
