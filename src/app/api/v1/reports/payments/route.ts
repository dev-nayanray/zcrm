import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { toDecimal } from "@/lib/decimal";
import { AccountingService } from "@/lib/services/accounting";
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
    const where: Prisma.PaymentWhereInput = {};
    if (Object.keys(rangeCreatedAt).length) where.createdAt = rangeCreatedAt;

    const payments = await db.payment.findMany({ where, include: { order: { select: { orderNumber: true } }, customer: { select: { name: true, phone: true } } } });
    const total = payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
    const byMethod = await AccountingService.paymentStats(range);

    // outstanding orders
    const unpaidOrders = await db.order.findMany({
      where: { status: { not: "CANCELLED" }, paymentStatus: { in: ["UNPAID", "PARTIAL"] } },
      include: { customer: true },
    });
    const outstandingTotal = unpaidOrders.reduce((s, o) => s.add(o.total).minus(o.paidAmount), new Prisma.Decimal(0));

    return ok({
      totalPaid: total.toFixed(2),
      paymentCount: payments.length,
      byMethod,
      payments: payments.slice(0, 200).map((p) => ({ id: p.id, amount: p.amount.toFixed(2), method: p.method, transactionReference: p.transactionReference, customer: p.customer, order: p.order, createdAt: p.createdAt })),
      unpaidOrdersCount: unpaidOrders.length,
      outstandingTotal: outstandingTotal.toFixed(2),
      unpaidOrders: unpaidOrders.slice(0, 200).map((o) => ({ id: o.id, orderNumber: o.orderNumber, customer: o.customer, total: o.total.toFixed(2), paid: o.paidAmount.toFixed(2), outstanding: toDecimal(o.total).minus(toDecimal(o.paidAmount)).toFixed(2), paymentStatus: o.paymentStatus })),
      range: { from: range.from?.toISOString(), to: range.to?.toISOString() },
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
