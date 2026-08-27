import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { resolveRange } from "@/lib/date-range";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("reports:read");
    if (err) return err;
    const sp = request.nextUrl.searchParams;
    const range = resolveRange(sp.get("preset") || undefined, sp.get("from") || undefined, sp.get("to") || undefined);

    const rangeCreatedAt: Record<string, Date> = {};
    if (range.from) rangeCreatedAt.gte = range.from;
    if (range.to) rangeCreatedAt.lte = range.to;

    const customers = await db.customer.findMany({
      include: {
        orders: { where: Object.keys(rangeCreatedAt).length ? { createdAt: rangeCreatedAt } : {}, select: { total: true, status: true, paidAmount: true } },
        payments: { where: Object.keys(rangeCreatedAt).length ? { createdAt: rangeCreatedAt } : {}, select: { amount: true } },
      },
    });
    const items = customers
      .map((c) => {
        const orderCount = c.orders.length;
        const totalSpending = c.orders.reduce((s, o) => s.add(o.total), new Prisma.Decimal(0));
        const totalPaid = c.payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
        const outstanding = totalSpending.minus(totalPaid).lt(0) ? new Prisma.Decimal(0) : totalSpending.minus(totalPaid);
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          city: c.city,
          orderCount,
          totalSpending: totalSpending.toFixed(2),
          totalPaid: totalPaid.toFixed(2),
          outstanding: outstanding.toFixed(2),
        };
      })
      .filter((c) => c.orderCount > 0)
      .sort((a, b) => Number(b.totalSpending) - Number(a.totalSpending));
    return ok({ items, range: { from: range.from?.toISOString(), to: range.to?.toISOString() } });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
