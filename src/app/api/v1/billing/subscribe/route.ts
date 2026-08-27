import { NextRequest } from "next/server";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { BillingService } from "@/lib/services/billing";

export async function POST(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("billing:create" as any);
    if (err) return err;
    const body = await readJsonBody<{ plan: string; method: string; payerNumber?: string; payerReference?: string; gatewayId?: string }>(request);
    if (!body?.plan || !body?.method) return badRequest("plan and method required");
    if (!["WEEKLY", "MONTHLY", "YEARLY", "LIFETIME"].includes(body.plan)) return badRequest("Invalid plan");
    if (!["BKASH", "NAGAD", "BANK", "CASH", "WALLET", "MANUAL", "SSLCOMMERZ", "CARD"].includes(body.method)) return badRequest("Invalid method");
    try {
      const result = await BillingService.createSubscription(user!.id, body.plan as any, body.method, body.payerNumber, body.payerReference, body.gatewayId);
      return ok(result);
    } catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
