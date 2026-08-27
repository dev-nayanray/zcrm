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
    return ok(await BillingService.walletTransactions(user!.id, { page: q.page, limit: q.limit }));
  } catch (e) { return serverError((e as Error).message); }
}
