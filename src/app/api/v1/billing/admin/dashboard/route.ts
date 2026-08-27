import { NextRequest } from "next/server";
import { ok, serverError, forbidden } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { BillingService } from "@/lib/services/billing";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role.name !== "SUPER_ADMIN" && user.role.name !== "ADMIN")) return forbidden("Super admin access required");
    return ok(await BillingService.adminDashboard());
  } catch (e) { return serverError((e as Error).message); }
}
