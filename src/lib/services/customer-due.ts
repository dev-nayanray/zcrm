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
// FIX: recordAdvance and setCreditLimit now validate amount positivity and
// write audit logs (previously unaudited — a serious gap for a finance
// operation). The list endpoint now returns the FILTERED total (was: the
// unfiltered count, so pagination was broken when filtering by status).
export const CustomerDueService = {
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
      data: { advanceAmount: toDecimal(credit.advanceAmount).plus(amt) },
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
      data: { creditLimit: amt },
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
