import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";

// AccountingService — THE single source of truth for financial calculation.
// Both the Dashboard and every Report call this service. Do not duplicate
// accounting formulas elsewhere.
//
// Model (consistent throughout the app):
//   Revenue        = sum(order.total) for delivered/confirmed orders in range
//                    (order.total already includes shippingCost + otherCost)
//   Gross Sales    = sum(order.subtotal - order.discount) (excludes shipping/other)
//   Discounts      = sum(order.discount)
//   COGS           = sum(orderItem.unitCost * quantity) for those orders
//                    (uses historical snapshot — unaffected by later price changes)
//   Order Costs    = sum(order.shippingCost + order.otherCost) (fulfillment costs)
//   Refunds        = sum(refund.amount)
//   Gross Profit   = Revenue - Refunds - COGS - shippingCost - otherCost
//                    (matches the per-order profit formula in /orders/[id] route)
//   Operating Exp. = sum(expense.amount)
//   Net Profit     = Gross Profit - Operating Expenses
//
// FIX: the previous formula ignored shippingCost + otherCost when computing
// grossProfit, which disagreed with the per-order detail (which DOES
// subtract them). Also the previous outstanding formula subtracted
// refunds a second time even though paidTotal is already net of refunds
// (RefundService.create reduces order.paidAmount on each refund). Both
// bugs are fixed below.

export type DateRange = { from?: Date; to?: Date };

function dateRangeCondition(range?: DateRange): { gte?: Date; lte?: Date } {
  if (!range || (!range.from && !range.to)) return {};
  const cond: { gte?: Date; lte?: Date } = {};
  if (range.from) cond.gte = range.from;
  if (range.to) cond.lte = range.to;
  return cond;
}

function rangeWhere(range?: DateRange) {
  const cond = dateRangeCondition(range);
  return Object.keys(cond).length ? { createdAt: cond } : {};
}

export const AccountingService = {
  // Comprehensive P&L for a date range.
  async profitAndLoss(range?: DateRange) {
    // Orders within range (exclude CANCELLED — those aren't sales)
    const orderWhere = { ...rangeWhere(range), status: { not: "CANCELLED" } };
    const orders = await db.order.findMany({
      where: orderWhere,
      include: { items: true, payments: true },
    });

    let grossSales = new Prisma.Decimal(0);
    let discounts = new Prisma.Decimal(0);
    let shippingCost = new Prisma.Decimal(0);
    let otherCost = new Prisma.Decimal(0);
    let revenue = new Prisma.Decimal(0);
    let cogs = new Prisma.Decimal(0);
    let paidTotal = new Prisma.Decimal(0);
    let orderCount = orders.length;

    for (const o of orders) {
      grossSales = grossSales.plus(toDecimal(o.subtotal));
      discounts = discounts.plus(toDecimal(o.discount));
      shippingCost = shippingCost.plus(toDecimal(o.shippingCost));
      otherCost = otherCost.plus(toDecimal(o.otherCost));
      revenue = revenue.plus(toDecimal(o.total));
      paidTotal = paidTotal.plus(toDecimal(o.paidAmount));
      for (const it of o.items) {
        cogs = cogs.plus(toDecimal(it.unitCost).times(toDecimal(it.quantity)));
      }
    }

    // Refunds in range
    const refundAgg = await db.refund.aggregate({
      where: rangeWhere(range),
      _sum: { amount: true },
    });
    const refunds = toDecimal(refundAgg._sum.amount ?? 0);

    // Operating expenses in range
    const expenseAgg = await db.expense.aggregate({
      where: { expenseDate: dateRangeCondition(range) },
      _sum: { amount: true },
    });
    const operatingExpenses = toDecimal(expenseAgg._sum.amount ?? 0);

    const netRevenue = revenue.minus(refunds);
    // Subtract fulfillment costs (shipping + other) from gross profit so
    // the P&L matches the per-order profit formula in /orders/[id] route:
    //   profit = revenue - cogs - shippingCost - otherCost
    const grossProfit = netRevenue.minus(cogs).minus(shippingCost).minus(otherCost);
    const netProfit = grossProfit.minus(operatingExpenses);

    // outstanding: revenue minus what was actually paid. paidTotal already
    // reflects refunds (RefundService.create reduces order.paidAmount on
    // each refund), so we do NOT subtract refunds a second time.
    const outstandingRaw = revenue.minus(paidTotal);
    const outstanding = outstandingRaw.lt(0) ? new Prisma.Decimal(0) : outstandingRaw;

    return {
      orderCount,
      grossSales,
      discounts,
      shippingCost,
      otherCost,
      revenue,
      refunds,
      netRevenue,
      cogs,
      grossProfit,
      operatingExpenses,
      netProfit,
      paidTotal,
      outstanding,
      fulfillmentCosts: shippingCost.plus(otherCost),
    };
  },

  // Sales-by-channel breakdown.
  async salesByChannel(range?: DateRange) {
    const orders = await db.order.findMany({
      where: { ...rangeWhere(range), status: { not: "CANCELLED" } },
      include: { channel: true },
    });
    const map = new Map<string, { name: string; revenue: Prisma.Decimal; orders: number; cogs: Prisma.Decimal }>();
    for (const o of orders) {
      const key = o.channel?.name ?? "Unknown";
      const entry = map.get(key) ?? { name: key, revenue: new Prisma.Decimal(0), orders: 0, cogs: new Prisma.Decimal(0) };
      entry.revenue = entry.revenue.plus(toDecimal(o.total));
      entry.orders += 1;
      map.set(key, entry);
    }
    return Array.from(map.values()).map((v) => ({
      name: v.name,
      revenue: v.revenue.toFixed(2),
      orders: v.orders,
    }));
  },

  // Top products by revenue & profit (uses historical snapshots).
  async topProducts(range?: DateRange, limit = 10) {
    const items = await db.orderItem.findMany({
      where: {
        order: { ...rangeWhere(range), status: { not: "CANCELLED" } },
      },
      include: { product: true },
    });
    const map = new Map<
      string,
      { productId: string; name: string; sku: string; qty: Prisma.Decimal; revenue: Prisma.Decimal; cogs: Prisma.Decimal; profit: Prisma.Decimal }
    >();
    for (const it of items) {
      const qty = toDecimal(it.quantity);
      const revenue = toDecimal(it.total);
      const cogs = toDecimal(it.unitCost).times(qty);
      const profit = revenue.minus(cogs);
      const entry = map.get(it.productId) ?? {
        productId: it.productId,
        name: it.product?.name ?? it.productName,
        sku: it.sku,
        qty: new Prisma.Decimal(0),
        revenue: new Prisma.Decimal(0),
        cogs: new Prisma.Decimal(0),
        profit: new Prisma.Decimal(0),
      };
      entry.qty = entry.qty.plus(qty);
      entry.revenue = entry.revenue.plus(revenue);
      entry.cogs = entry.cogs.plus(cogs);
      entry.profit = entry.profit.plus(profit);
      map.set(it.productId, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue.minus(a.revenue).toNumber())
      .slice(0, limit)
      .map((v) => ({
        productId: v.productId,
        name: v.name,
        sku: v.sku,
        quantity: v.qty.toFixed(3),
        revenue: v.revenue.toFixed(2),
        cogs: v.cogs.toFixed(2),
        profit: v.profit.toFixed(2),
      }));
  },

  // Sales/payment/expense trend by day for charts.
  async trend(days = 30) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    from.setHours(0, 0, 0, 0);

    const orders = await db.order.findMany({
      where: { createdAt: { gte: from, lte: to }, status: { not: "CANCELLED" } },
    });
    const expenses = await db.expense.findMany({
      where: { expenseDate: { gte: from, lte: to } },
    });

    const buckets: Record<string, { sales: Prisma.Decimal; expenses: Prisma.Decimal; orders: number; profit: Prisma.Decimal }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { sales: new Prisma.Decimal(0), expenses: new Prisma.Decimal(0), orders: 0, profit: new Prisma.Decimal(0) };
    }

    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      if (buckets[key]) {
        buckets[key].sales = buckets[key].sales.plus(toDecimal(o.total));
        buckets[key].orders += 1;
      }
    }
    for (const e of expenses) {
      const key = e.expenseDate.toISOString().slice(0, 10);
      if (buckets[key]) buckets[key].expenses = buckets[key].expenses.plus(toDecimal(e.amount));
    }

    return Object.entries(buckets).map(([date, v]) => ({
      date,
      sales: v.sales.toFixed(2),
      expenses: v.expenses.toFixed(2),
      orders: v.orders,
    }));
  },

  // Aggregate payment stats by method.
  async paymentStats(range?: DateRange) {
    const rows = await db.payment.findMany({ where: rangeWhere(range) });
    const map = new Map<string, { method: string; total: Prisma.Decimal; count: number }>();
    for (const p of rows) {
      const entry = map.get(p.method) ?? { method: p.method, total: new Prisma.Decimal(0), count: 0 };
      entry.total = entry.total.plus(toDecimal(p.amount));
      entry.count += 1;
      map.set(p.method, entry);
    }
    return Array.from(map.values()).map((v) => ({
      method: v.method,
      total: v.total.toFixed(2),
      count: v.count,
    }));
  },

  // Expense breakdown by category.
  async expenseByCategory(range?: DateRange) {
    const rows = await db.expense.findMany({
      where: { expenseDate: rangeWhere(range).createdAt ?? {} },
      include: { category: true },
    });
    const map = new Map<string, { category: string; total: Prisma.Decimal; count: number }>();
    for (const e of rows) {
      const name = e.category?.name ?? "Other";
      const entry = map.get(name) ?? { category: name, total: new Prisma.Decimal(0), count: 0 };
      entry.total = entry.total.plus(toDecimal(e.amount));
      entry.count += 1;
      map.set(name, entry);
    }
    return Array.from(map.values()).map((v) => ({
      category: v.category,
      total: v.total.toFixed(2),
      count: v.count,
    }));
  },
};
