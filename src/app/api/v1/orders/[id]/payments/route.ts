import { NextRequest } from "next/server";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { createPaymentSchema } from "@/lib/validation";
import { PaymentService } from "@/lib/services/payment";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("payments:read");
    if (err) return err;
    const { id } = await ctx.params;
    const items = await PaymentService.forOrder(id);
    return ok({ items });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("payments:create");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody(request);
    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    try {
      const payment = await PaymentService.create({ orderId: id, ...parsed.data });
      return ok(payment);
    } catch (e) {
      return badRequest((e as Error).message);
    }
  } catch (e) {
    return serverError((e as Error).message);
  }
}
