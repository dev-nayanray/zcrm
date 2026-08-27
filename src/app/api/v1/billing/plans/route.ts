import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { BillingService } from "@/lib/services/billing";

export async function GET(_request: NextRequest) {
  try {
    return ok({ items: BillingService.listPlans() });
  } catch (e) { return serverError((e as Error).message); }
}
