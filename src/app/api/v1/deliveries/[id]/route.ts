import { NextRequest } from "next/server";
import { ok, serverError, notFound, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { DeliveryService } from "@/lib/services/delivery";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("deliveries:read");
    if (err) return err;
    const { id } = await ctx.params;
    const d = await DeliveryService.get(id);
    if (!d) return notFound("Delivery not found");
    return ok({ ...d, deliveryCharge: d.deliveryCharge.toFixed(2), codAmount: d.codAmount.toFixed(2) });
  } catch (e) { return serverError((e as Error).message); }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("deliveries:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<{ status?: string; note?: string }>(request);
    if (!body?.status) return badRequest("status required");
    // Validate status transition: only forward transitions and the
    // allowed set are accepted.
    const allowed = ["PENDING", "PICKED_UP", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED", "CANCELLED"];
    if (!allowed.includes(body.status)) return badRequest(`Invalid status. Allowed: ${allowed.join(", ")}`);
    try {
      const updated = await DeliveryService.updateStatus(id, body.status, body.note);
      return ok({ ...updated, deliveryCharge: updated!.deliveryCharge.toFixed(2), codAmount: updated!.codAmount.toFixed(2) });
    } catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
