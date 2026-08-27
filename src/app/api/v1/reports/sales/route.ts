import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { AccountingService } from "@/lib/services/accounting";
import { resolveRange } from "@/lib/date-range";
import { toDecimal } from "@/lib/decimal";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("reports:read");
    if (err) return err;
    const sp = request.nextUrl.searchParams;
    const range = resolveRange(sp.get("preset") || undefined, sp.get("from") || undefined, sp.get("to") || undefined);

    const rangeCreatedAt: Record<string, Date> = {};
    if (range.from) rangeCreatedAt.gte = range.from;
    if (range.to) rangeCreatedAt.lte = range.to;
    const where: Prisma.OrderWhereInput = { status: { not: "CANCELLED" } };
    if (Object.keys(rangeCreatedAt).length) where.createdAt = rangeCreatedAt;

    const orders = await db.order.findMany({ where, include: { items: true, channel: true } });
    let grossSales = new Prisma.Decimal(0);
    let discounts = new Prisma.Decimal(0);
    let netSales = new Prisma.Decimal(0);
    let total = new Prisma.Decimal(0);
    for (const o of orders) {
      grossSales = grossSales.add(o.subtotal);
      discounts = discounts.add(o.discount);
      netSales = netSales.add(o.subtotal).minus(o.discount);
      total = total.add(o.total);
    }
    const avgOrderValue = orders.length ? toDecimal(total).div(orders.length) : new Prisma.Decimal(0);

    const byChannel = await AccountingService.salesByChannel(range);
    const topProducts = await AccountingService.topProducts(range, 20);

    return ok({
      orderCount: orders.length,
      grossSales: grossSales.toFixed(2),
      discounts: discounts.toFixed(2),
      netSales: netSales.toFixed(2),
      total: total.toFixed(2),
      averageOrderValue: avgOrderValue.toFixed(2),
      byChannel,
      topProducts,
      range: { from: range.from?.toISOString(), to: range.to?.toISOString() },
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
