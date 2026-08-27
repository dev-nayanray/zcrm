import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, notFound, badRequest } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { PurchaseService } from "@/lib/services/purchase";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("purchases:read");
    if (err) return err;
    const { id } = await ctx.params;
    const purchase = await db.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: { include: { product: { select: { name: true, sku: true, sellingPrice: true } } } },
        creator: { select: { id: true, name: true } },
      },
    });
    if (!purchase) return notFound("Purchase not found");
    return ok({
      ...purchase,
      subtotal: purchase.subtotal.toFixed(2),
      discount: purchase.discount.toFixed(2),
      shippingCost: purchase.shippingCost.toFixed(2),
      total: purchase.total.toFixed(2),
      paidAmount: purchase.paidAmount.toFixed(2),
      dueAmount: purchase.dueAmount.toFixed(2),
      items: purchase.items.map((it) => ({
        ...it,
        quantity: it.quantity.toFixed(3),
        unitCost: it.unitCost.toFixed(2),
        total: it.total.toFixed(2),
      })),
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("purchases:update");
    if (err) return err;
    const { id } = await ctx.params;
    const url = request.nextUrl;
    if (url.searchParams.get("action") === "receive") {
      try {
        const updated = await PurchaseService.receive(id);
        return ok(updated);
      } catch (e) {
        return badRequest((e as Error).message);
      }
    }
    return badRequest("Unknown action. Use ?action=receive");
  } catch (e) {
    return serverError((e as Error).message);
  }
}
