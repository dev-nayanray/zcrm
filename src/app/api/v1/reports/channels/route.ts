import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { resolveRange } from "@/lib/date-range";
import { toDecimal } from "@/lib/decimal";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("reports:read");
    if (err) return err;
    const sp = request.nextUrl.searchParams;
    const range = resolveRange(sp.get("preset") || undefined, sp.get("from") || undefined, sp.get("to") || undefined);

    const rangeCreated: Record<string, Date> = {};
    if (range.from) rangeCreated.gte = range.from;
    if (range.to) rangeCreated.lte = range.to;
    const where: Prisma.OrderWhereInput = { status: { not: "CANCELLED" } };
    if (Object.keys(rangeCreated).length) where.createdAt = rangeCreated;

    const orders = await db.order.findMany({
      where,
      include: { channel: true, items: true, payments: true },
    });

    const map = new Map<string, { channelId: string; name: string; orders: number; revenue: Prisma.Decimal; paid: Prisma.Decimal; cogs: Prisma.Decimal }>();
    for (const o of orders) {
      const name = o.channel?.name ?? "Unknown";
      const cid = o.channel?.id ?? "unknown";
      const entry = map.get(cid) ?? { channelId: cid, name, orders: 0, revenue: new Prisma.Decimal(0), paid: new Prisma.Decimal(0), cogs: new Prisma.Decimal(0) };
      entry.orders += 1;
      entry.revenue = entry.revenue.plus(toDecimal(o.total));
      entry.paid = entry.paid.plus(toDecimal(o.paidAmount));
      for (const it of o.items) entry.cogs = entry.cogs.plus(toDecimal(it.unitCost).times(toDecimal(it.quantity)));
      map.set(cid, entry);
    }

    const items = Array.from(map.values()).map((v) => {
      const profit = v.revenue.minus(v.cogs);
      const avgOrderValue = v.orders ? v.revenue.div(v.orders) : new Prisma.Decimal(0);
      return {
        channelId: v.channelId, name: v.name, orders: v.orders,
        revenue: v.revenue.toFixed(2), paid: v.paid.toFixed(2), cogs: v.cogs.toFixed(2),
        profit: profit.toFixed(2), averageOrderValue: avgOrderValue.toFixed(2),
      };
    }).sort((a, b) => Number(b.revenue) - Number(a.revenue));

    return ok({ items, range: { from: range.from?.toISOString(), to: range.to?.toISOString() } });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
