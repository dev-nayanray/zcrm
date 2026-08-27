import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { BillingService } from "@/lib/services/billing";

export async function POST(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("billing:create" as any);
    if (err) return err;
    const body = await readJsonBody<{ amount: string | number; method: string; reference?: string }>(request);
    if (!body?.amount || !body?.method) return badRequest("amount and method required");
    try {
      return ok(await BillingService.walletDeposit(user!.id, body.amount, body.method, body.reference));
    } catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
