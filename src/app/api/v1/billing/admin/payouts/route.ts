import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { BillingService } from "@/lib/services/billing";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("billing:manage_payouts" as any);
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status") || undefined;
    return ok(await BillingService.listPayouts({ page: q.page, limit: q.limit, status }));
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("billing:manage_payouts" as any);
    if (err) return err;
    const body = await readJsonBody<any>(request);
    if (!body?.amount || !body?.type) return badRequest("amount and type required");
    try {
      return ok(await BillingService.createPayout(body));
    } catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
