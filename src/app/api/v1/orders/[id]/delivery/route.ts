import { NextRequest } from "next/server";
import { ok, serverError, badRequest, notFound } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { DeliveryService } from "@/lib/services/delivery";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("orders:read");
    if (err) return err;
    const { id } = await ctx.params;
    const delivery = await DeliveryService.forOrder(id);
    if (!delivery) return notFound("No delivery for this order");
    return ok({ ...delivery, deliveryCharge: delivery.deliveryCharge.toFixed(2), codAmount: delivery.codAmount.toFixed(2) });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("deliveries:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<any>(request);
    try {
      const d = await DeliveryService.create({ ...body, orderId: id });
      return ok({ ...d, deliveryCharge: d!.deliveryCharge.toFixed(2), codAmount: d!.codAmount.toFixed(2) });
    } catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
