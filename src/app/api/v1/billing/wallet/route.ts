import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { BillingService } from "@/lib/services/billing";

export async function GET(_request: NextRequest) {
  try {
    const [user, err] = await requirePermission("billing:read" as any);
    if (err) return err;
    return ok(await BillingService.getWalletBalance(user!.id));
  } catch (e) { return serverError((e as Error).message); }
}
