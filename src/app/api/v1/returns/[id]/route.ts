import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, notFound } from "@/lib/api";
import { requirePermission } from "@/lib/guards";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("returns:read");
    if (err) return err;
    const { id } = await ctx.params;
    const ret = await db.return.findUnique({
      where: { id },
      include: {
        order: true,
        customer: true,
        items: { include: { product: { select: { name: true, sku: true } } } },
        refunds: true,
        creator: { select: { id: true, name: true } },
      },
    });
    if (!ret) return notFound("Return not found");
    return ok({ ...ret, refundAmount: ret.refundAmount.toFixed(2) });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
