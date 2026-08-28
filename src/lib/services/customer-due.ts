import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";
import { AuditService } from "./audit";
import { getCurrentUser } from "@/lib/auth";

// CustomerDueService — customer credit / due management. Computes per-customer
// financial balance from the same Order + Payment + Refund + CustomerCredit
// tables (no duplicate accounting). Supports advance payments (credit) stored
// in CustomerCredit.advanceAmount.
//
// ─────────────────────────────────────────────────────────────────────────────
// DUE FORMULA (the single source of truth)
// ─────────────────────────────────────────────────────────────────────────────
//   totalDue = Σ(order.total where status != CANCELLED)
//              − Σ(payment.amount)
//              + Σ(refund.amount)        // refunds increase due (we owe the customer)
//              − Σ(customerCredit.advanceAmount)  // customer pre-payments reduce due
//
// The `due` is DERIVED — never stored as a balance. The CustomerCredit row
// only holds `advanceAmount` (customer pre-payment) and `creditLimit`.
//
// AGING BUCKETS (computed per-order based on each order's `createdAt`):
//   0–7 days | 8–30 days | 31–60 days | 61–90 days | 90+ days
//
// FIX: recordAdvance and setCreditLimit now validate amount positivity and
// write audit logs (previously unaudited — a serious gap for a finance
// operation). The list endpoint now returns the FILTERED total (was: the
// unfiltered count, so pagination was broken when filtering by status).
export const CustomerDueService = {
  /**
   * Compute a single customer's due, derived live from orders + payments +
   * refunds + advance. This is the canonical due figure — every other
   * method on this service ultimately calls this.
   *
   * Returns:
   *   totalSales, totalPaid, totalRefund, advance, totalDue,
   *   outstandingOrders[] (per-order due breakdown with aging bucket),
   *   aging: { "0-7": n, "8-30": n, "31-60": n, "61-90": n, "90+": n }
   *   lastPayment: { amount, method, date } | null
   */
  async computeDue(customerId: string) {
    const customer = await db.customer.findUnique({ where: { id: customerId }, include: { customerCredit: true } });
    if (!customer) throw new Error("Customer not found");

    // Aggregate orders (exclude CANCELLED — they're not sales)
    const orderAgg = await db.order.aggregate({
      where: { customerId, status: { not: "CANCELLED" } },
      _sum: { total: true, paidAmount: true },
      _count: true,
    });
    const totalSales = toDecimal(orderAgg._sum.total ?? 0);

    // Aggregate payments
    const payAgg = await db.payment.aggregate({ where: { customerId }, _sum: { amount: true } });
    const totalPaid = toDecimal(payAgg._sum.amount ?? 0);

    // Aggregate refunds (refunds increase due — we owe the customer)
    const refundAgg = await db.refund.aggregate({
      where: { order: { customerId } },
      _sum: { amount: true },
    });
    const totalRefund = toDecimal(refundAgg._sum.amount ?? 0);

    // Advance payment (customer pre-payment) reduces due
    const advance = toDecimal(customer.customerCredit?.advanceAmount ?? 0);

    // Total due — never let it go negative (negative means we owe the
    // customer, which is captured by the `advance` field separately).
    const rawDue = totalSales.minus(totalPaid).plus(totalRefund).minus(advance);
    const totalDue = rawDue.lt(0) ? new Prisma.Decimal(0) : rawDue;

    // Per-order due breakdown for aging
    const orders = await db.order.findMany({
      where: { customerId, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        paidAmount: true,
        createdAt: true,
        status: true,
      },
    });
    const outstandingOrders = orders
      .map((o) => {
        const due = toDecimal(o.total).minus(toDecimal(o.paidAmount));
        const duePositive = due.lt(0) ? new Prisma.Decimal(0) : due;
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          total: toDecimal(o.total).toFixed(2),
          paid: toDecimal(o.paidAmount).toFixed(2),
          due: duePositive.toFixed(2),
          createdAt: o.createdAt,
          status: o.status,
          ageDays: Math.floor((Date.now() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        };
      })
      .filter((o) => Number(o.due) > 0);

    // Aging buckets
    const aging = { "0-7": new Prisma.Decimal(0), "8-30": new Prisma.Decimal(0), "31-60": new Prisma.Decimal(0), "61-90": new Prisma.Decimal(0), "90+": new Prisma.Decimal(0) };
    for (const o of outstandingOrders) {
      const due = toDecimal(o.due);
      if (o.ageDays <= 7) aging["0-7"] = aging["0-7"].plus(due);
      else if (o.ageDays <= 30) aging["8-30"] = aging["8-30"].plus(due);
      else if (o.ageDays <= 60) aging["31-60"] = aging["31-60"].plus(due);
      else if (o.ageDays <= 90) aging["61-90"] = aging["61-90"].plus(due);
      else aging["90+"] = aging["90+"].plus(due);
    }

    // Last payment
    const lastPayment = await db.payment.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { amount: true, method: true, createdAt: true, transactionReference: true },
    });

    return {
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      totalSales: totalSales.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalRefund: totalRefund.toFixed(2),
      advance: advance.toFixed(2),
      totalDue: totalDue.toFixed(2),
      orderCount: orderAgg._count,
      outstandingOrders,
      aging: {
        "0-7": aging["0-7"].toFixed(2),
        "8-30": aging["8-30"].toFixed(2),
        "31-60": aging["31-60"].toFixed(2),
        "61-90": aging["61-90"].toFixed(2),
        "90+": aging["90+"].toFixed(2),
      },
      lastPayment: lastPayment
        ? { amount: toDecimal(lastPayment.amount).toFixed(2), method: lastPayment.method, date: lastPayment.createdAt, reference: lastPayment.transactionReference }
        : null,
    };
  },

  async list(opts: { page: number; limit: number; search?: string; minDue?: number; status?: string; from?: Date; to?: Date }) {
    const where: Prisma.CustomerWhereInput = {};
    if (opts.search) where.OR = [{ name: { contains: opts.search } }, { phone: { contains: opts.search } }, { email: { contains: opts.search } }, { city: { contains: opts.search } }];
    if (opts.from || opts.to) {
      const created: Record<string, Date> = {};
      if (opts.from) created.gte = opts.from;
      if (opts.to) created.lte = opts.to;
      where.createdAt = created;
    }
    // Fetch the full filtered set (bounded by an explicit take to avoid
    // unbounded scans) so we can compute the post-filter total correctly.
    // The previous implementation returned `out.length` as `total` AFTER
    // filtering, but `out` was the unfiltered list — so pagination broke
    // when status filtering reduced the visible count.
    const customers = await db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500, // bound to avoid unbounded scan
      include: {
        _count: { select: { orders: true } },
        customerCredit: true,
      },
    });
    const out = await Promise.all(customers.map(async (c) => {
      const orderTotal = await db.order.aggregate({ where: { customerId: c.id, status: { not: "CANCELLED" } }, _sum: { total: true, paidAmount: true } });
      const payAgg = await db.payment.aggregate({ where: { customerId: c.id }, _sum: { amount: true } });
      const refundAgg = await db.refund.aggregate({ where: { order: { customerId: c.id } }, _sum: { amount: true } });
      const totalSales = toDecimal(orderTotal._sum.total ?? 0);
      const totalPaid = toDecimal(payAgg._sum.amount ?? 0);
      const totalRefund = toDecimal(refundAgg._sum.amount ?? 0);
      const advance = toDecimal(c.customerCredit?.advanceAmount ?? 0);
      const totalDue = totalSales.minus(totalPaid).plus(totalRefund).minus(advance).lt(0) ? new Prisma.Decimal(0) : totalSales.minus(totalPaid).plus(totalRefund).minus(advance);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        city: c.city,
        orderCount: c._count.orders,
        totalSales: totalSales.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        totalRefund: totalRefund.toFixed(2),
        advance: advance.toFixed(2),
        totalDue: totalDue.toFixed(2),
        creditLimit: toDecimal(c.customerCredit?.creditLimit ?? 0).toFixed(2),
      };
    }));
    let filtered = out;
    if (opts.minDue && opts.minDue > 0) filtered = out.filter((c) => Number(c.totalDue) >= opts.minDue!);
    if (opts.status === "DUE") filtered = out.filter((c) => Number(c.totalDue) > 0);
    if (opts.status === "PAID") filtered = out.filter((c) => Number(c.totalDue) <= 0);
    // Return the FILTERED total so the frontend can paginate correctly.
    return { items: filtered, total: filtered.length };
  },

  // Get or create the CustomerCredit row.
  async getCredit(customerId: string) {
    let credit = await db.customerCredit.findUnique({ where: { customerId } });
    if (!credit) credit = await db.customerCredit.create({ data: { customerId } });
    return credit;
  },

  // Record an advance payment (customer credit). Increases advanceAmount.
  // Validates amount > 0 and writes an audit log.
  async recordAdvance(customerId: string, amount: number | string, notes?: string) {
    const amt = toDecimal(amount);
    if (amt.lte(0)) throw new Error("Advance amount must be greater than zero");
    const user = await getCurrentUser();
    // Verify the customer exists.
    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error("Customer not found");
    const credit = await this.getCredit(customerId);
    const updated = await db.customerCredit.update({
      where: { customerId },
      data: { advanceAmount: toDecimal(credit.advanceAmount).plus(amt).toNumber() },
    });
    await AuditService.log({
      userId: user?.id,
      action: "CUSTOMER_ADVANCE",
      entity: "CustomerCredit",
      entityId: updated.id,
      changes: { customerId, amount: amt.toFixed(2), notes },
    });
    return { ...updated, advanceAmount: updated.advanceAmount.toFixed(2), creditLimit: updated.creditLimit.toFixed(2), notes };
  },

  // Set a customer's credit limit. Validates limit >= 0.
  async setCreditLimit(customerId: string, limit: number | string) {
    const amt = toDecimal(limit);
    if (amt.lt(0)) throw new Error("Credit limit must be non-negative");
    const user = await getCurrentUser();
    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error("Customer not found");
    const credit = await this.getCredit(customerId);
    const updated = await db.customerCredit.update({
      where: { customerId },
      data: { creditLimit: amt.toNumber() },
    });
    await AuditService.log({
      userId: user?.id,
      action: "CUSTOMER_CREDIT_LIMIT",
      entity: "CustomerCredit",
      entityId: updated.id,
      changes: { customerId, previousLimit: credit.creditLimit.toFixed(2), newLimit: amt.toFixed(2) },
    });
    return updated;
  },
};
