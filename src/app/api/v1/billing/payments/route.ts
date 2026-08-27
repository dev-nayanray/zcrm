import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { BillingService } from "@/lib/services/billing";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("billing:read" as any);
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status") || undefined;
    // SUPER_ADMIN/ADMIN can see all; others see only their own
    const isAdmin = user!.role.name === "SUPER_ADMIN" || user!.role.name === "ADMIN";
    const userId = isAdmin ? (request.nextUrl.searchParams.get("userId") || undefined) : user!.id;
    return ok(await BillingService.listPayments({ page: q.page, limit: q.limit, status, userId }));
  } catch (e) { return serverError((e as Error).message); }
}
