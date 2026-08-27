import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { BillingService } from "@/lib/services/billing";

export async function GET(_request: NextRequest) {
  try {
    const [user, err] = await requirePermission("billing:read" as any);
    if (err) return err;
    const sub = await BillingService.getCurrentSubscription(user!.id);
    if (sub) {
      return ok({ ...sub, amount: sub.amount.toFixed(2) });
    }
    return ok(null);
  } catch (e) { return serverError((e as Error).message); }
}
