import { NextRequest } from "next/server";
import { ok, serverError, badRequest, validationError } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { DeliveryService } from "@/lib/services/delivery";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("deliveries:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const courierProviderId = request.nextUrl.searchParams.get("courierProviderId") || undefined;
    const res = await DeliveryService.list({ page: q.page, limit: q.limit, status, courierProviderId, search: q.search });
    return ok({ items: res.items.map((d: any) => ({ ...d, deliveryCharge: d.deliveryCharge.toFixed(2), codAmount: d.codAmount.toFixed(2) })), total: res.total, page: q.page, limit: q.limit });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("deliveries:update");
    if (err) return err;
    const body = await readJsonBody<any>(request);
    if (!body?.orderId) return badRequest("orderId required");
    try {
      const d = await DeliveryService.create(body);
      return ok({ ...d, deliveryCharge: d!.deliveryCharge.toFixed(2), codAmount: d!.codAmount.toFixed(2) });
    } catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}

void validationError;
