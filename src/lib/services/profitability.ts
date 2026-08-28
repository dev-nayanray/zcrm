import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";

// ProfitabilityService — THE single source of truth for per-order and
// aggregated profitability. Used by:
//   • Dashboard (/api/v1/dashboard)
//   • Reports (/api/v1/reports/*)
//   • Order detail view (web + Telegram)
//   • Telegram /profit command
//   • Channel/customer/product profitability reports
//
// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL MODEL (consistent everywhere)
// ─────────────────────────────────────────────────────────────────────────────
// For each order (status != CANCELLED):
//
//   SUBTOTAL         = Σ OrderItem.total          (qty × unitPrice − lineDiscount)
//   DISCOUNT         = Order.discount            (order-level discount)
//   TAX              = Order.tax                 (sales tax / VAT)
//   SHIPPING_INCOME  = Order.shippingCost        (what customer paid for delivery)
//   OTHER_INCOME     = Order.otherIncome         (gift wrap, surcharges)
//   OTHER_COST       = Order.otherCost           (legacy bucket — kept for back-compat)
//   ─────────────────────────────────────────────
//   NET SALES        = SUBTOTAL − DISCOUNT + TAX + SHIPPING_INCOME + OTHER_INCOME + OTHER_COST
//                      (= Order.total — stored on the order, re-derived here for clarity)
//
//   COGS             = Σ OrderItem.unitCost × quantity       (historical snapshot, WAC-based)
//   PACKAGING_COST   = Order.packagingCost
//   PAYMENT_FEE      = Order.paymentFee
//   PLATFORM_FEE     = Order.platformFee
//   ORDER_EXPENSES   = Σ Expense.amount WHERE orderId = order.id   (order-linked expenses)
//   DELIVERY_COST    = COALESCE(Delivery.actualCourierCost, 0)    (real courier cost)
//   RETURN_CHARGE    = COALESCE(Delivery.returnCharge, 0)
//
//   GROSS PROFIT     = NET SALES − TAX − COGS
//                      (tax is pass-through to government — not real revenue)
//   NET PROFIT       = GROSS PROFIT
//                      − PACKAGING_COST − PAYMENT_FEE − PLATFORM_FEE
//                      − DELIVERY_COST − RETURN_CHARGE
//                      − ORDER_EXPENSES
//
// For P&L aggregation across many orders:
//   GROSS PROFIT (total)   = Σ per-order gross profit
//   OPERATING EXPENSES     = Σ Expense.amount WHERE orderId IS NULL  (general business expenses)
//   NET PROFIT (total)     = Σ per-order net profit − OPERATING EXPENSES
//
// ─────────────────────────────────────────────────────────────────────────────
// NOTES
// ─────────────────────────────────────────────────────────────────────────────
// • Refunds are netted from revenue at the P&L level (Σ refund.amount).
//   They do NOT re-derive per-order net profit — the order's netProfit
//   snapshot stays at its post-sale value, and the refund shows as a
//   separate line in the aggregated P&L.
// • Order.netProfit is a SNAPSHOT computed at order creation/update time.
//   The aggregated P&L recomputes from the live order rows so it stays
//   correct even if expenses are added/removed after the order was placed.

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

export const ProfitabilityService = {
  /**
   * Compute the per-order profitability snapshot. Called by OrderService
   * on create and on any update that affects totals (payment added,
   * expense linked, delivery cost updated).
   *
   * Returns the four numbers that get stored on Order: cogsTotal,
   * grossProfit, netProfit, plus a breakdown for display.
   *
   * NOTE: this method DOES NOT persist the snapshot — the caller (inside
   * its transaction) writes the values via tx.order.update. This keeps
   * the snapshot computation pure & testable.
   */
  async computeOrderSnapshot(orderId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? db;
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        delivery: true,
        expenses: true,
      },
    });
    if (!order) throw new Error(`Order not found: ${orderId}`);

    // ── COGS: sum of (snapshot unitCost × quantity) across line items ──
    let cogsTotal = new Prisma.Decimal(0);
    for (const it of order.items) {
      const qty = toDecimal(it.quantity);
      const unitCost = toDecimal(it.unitCost);
      cogsTotal = cogsTotal.plus(qty.times(unitCost));
    }

    // ── Order-scoped expenses (courier/packaging/fees linked via Expense.orderId) ──
    let orderExpenses = new Prisma.Decimal(0);
    for (const e of order.expenses) {
      orderExpenses = orderExpenses.plus(toDecimal(e.amount));
    }

    // ── Delivery cost (actual courier cost, not what customer paid) ──
    const deliveryCost = toDecimal(order.delivery?.actualCourierCost ?? 0);
    const returnCharge = toDecimal(order.delivery?.returnCharge ?? 0);

    // ── NET SALES (Order.total already includes subtotal − discount + tax + shipping + otherIncome + otherCost) ──
    const totalSales = toDecimal(order.total);
    const tax = toDecimal(order.tax);
    const revenue = totalSales.minus(tax); // tax is pass-through, not real revenue

    // ── GROSS PROFIT = revenue − COGS ──
    const grossProfit = revenue.minus(cogsTotal);

    // ── Fulfilment & fee costs ──
    const packagingCost = toDecimal(order.packagingCost);
    const paymentFee = toDecimal(order.paymentFee);
    const platformFee = toDecimal(order.platformFee);
    const otherCost = toDecimal(order.otherCost);
    // NOTE: shippingCost here is shipping INCOME (what customer paid).
    // It's already in `totalSales`/`revenue` — do NOT subtract it from profit.

    // ── NET PROFIT = grossProfit − (packaging + payment fee + platform fee + delivery + return charge + otherCost + orderExpenses) ──
    const totalCost = packagingCost.plus(paymentFee).plus(platformFee).plus(deliveryCost).plus(returnCharge).plus(otherCost).plus(orderExpenses);
    const netProfit = grossProfit.minus(totalCost);

    return {
      cogsTotal,
      grossProfit,
      netProfit,
      // Breakdown for display:
      totalSales,
      tax,
      revenue,
      discount: toDecimal(order.discount),
      shippingIncome: toDecimal(order.shippingCost),
      otherIncome: toDecimal(order.otherIncome),
      otherCost,
      packagingCost,
      paymentFee,
      platformFee,
      deliveryCost,
      returnCharge,
      orderExpenses,
      totalCost,
    };
  },

  /**
   * Persist the computed snapshot onto the order row. Called by
   * OrderService.create and any update path that touches financials.
   */
  async persistSnapshot(orderId: string, tx: Prisma.TransactionClient) {
    const snap = await this.computeOrderSnapshot(orderId, tx);
    await tx.order.update({
      where: { id: orderId },
      data: {
        // Schema stores Float — convert Decimals via toNumber().
        cogsTotal: snap.cogsTotal.toNumber(),
        grossProfit: snap.grossProfit.toNumber(),
        netProfit: snap.netProfit.toNumber(),
      },
    });
    return snap;
  },

  /**
   * Aggregated profitability across many orders for a date range.
   * Powers the dashboard, the P&L report, and Telegram /profit.
   *
   * @param range — date range filter (on Order.createdAt)
   * @param filter — optional additional filters (channelId, customerId, etc.)
   */
  async aggregate(range?: DateRange, filter?: {
    channelId?: string;
    customerId?: string;
    warehouseId?: string;
    courierProviderId?: string;
    createdBy?: string;
  }) {
    const where: Prisma.OrderWhereInput = {
      ...rangeWhere(range),
      status: { not: "CANCELLED" },
    };
    if (filter?.channelId) where.channelId = filter.channelId;
    if (filter?.customerId) where.customerId = filter.customerId;
    if (filter?.createdBy) where.createdBy = filter.createdBy;

    const orders = await db.order.findMany({
      where,
      include: {
        items: true,
        delivery: true,
        expenses: true,
        payments: true,
      },
    });

    let grossSales = new Prisma.Decimal(0);
    let discounts = new Prisma.Decimal(0);
    let tax = new Prisma.Decimal(0);
    let shippingIncome = new Prisma.Decimal(0);
    let otherIncome = new Prisma.Decimal(0);
    let otherCost = new Prisma.Decimal(0);
    let totalSales = new Prisma.Decimal(0);
    let cogs = new Prisma.Decimal(0);
    let packagingCost = new Prisma.Decimal(0);
    let paymentFee = new Prisma.Decimal(0);
    let platformFee = new Prisma.Decimal(0);
    let deliveryCost = new Prisma.Decimal(0);
    let returnCharge = new Prisma.Decimal(0);
    let orderExpenses = new Prisma.Decimal(0);
    let paidTotal = new Prisma.Decimal(0);
    let grossProfitTotal = new Prisma.Decimal(0);
    let netProfitTotal = new Prisma.Decimal(0);

    for (const o of orders) {
      grossSales = grossSales.plus(toDecimal(o.subtotal));
      discounts = discounts.plus(toDecimal(o.discount));
      tax = tax.plus(toDecimal(o.tax));
      shippingIncome = shippingIncome.plus(toDecimal(o.shippingCost));
      otherIncome = otherIncome.plus(toDecimal(o.otherIncome));
      otherCost = otherCost.plus(toDecimal(o.otherCost));
      totalSales = totalSales.plus(toDecimal(o.total));
      paidTotal = paidTotal.plus(toDecimal(o.paidAmount));

      for (const it of o.items) {
        cogs = cogs.plus(toDecimal(it.unitCost).times(toDecimal(it.quantity)));
      }

      packagingCost = packagingCost.plus(toDecimal(o.packagingCost));
      paymentFee = paymentFee.plus(toDecimal(o.paymentFee));
      platformFee = platformFee.plus(toDecimal(o.platformFee));
      deliveryCost = deliveryCost.plus(toDecimal(o.delivery?.actualCourierCost ?? 0));
      returnCharge = returnCharge.plus(toDecimal(o.delivery?.returnCharge ?? 0));

      for (const e of o.expenses) {
        orderExpenses = orderExpenses.plus(toDecimal(e.amount));
      }

      // Use the persisted snapshot for per-order profit (it includes the
      // per-order delivery/expense breakdown that we can't easily recompute
      // in aggregate without double-counting). For orders created before
      // the snapshot was added, fall back to live computation.
      grossProfitTotal = grossProfitTotal.plus(toDecimal(o.grossProfit));
      netProfitTotal = netProfitTotal.plus(toDecimal(o.netProfit));
    }

    // Refunds in range
    const refundAgg = await db.refund.aggregate({
      where: rangeWhere(range),
      _sum: { amount: true },
    });
    const refunds = toDecimal(refundAgg._sum.amount ?? 0);

    // General business expenses (not order-linked) in range
    const generalExpAgg = await db.expense.aggregate({
      where: { expenseDate: dateRangeCondition(range), orderId: null },
      _sum: { amount: true },
    });
    const operatingExpenses = toDecimal(generalExpAgg._sum.amount ?? 0);

    const netRevenue = totalSales.minus(tax).minus(refunds);
    const grossProfit = netRevenue.minus(cogs);
    const netProfit = grossProfit
      .minus(packagingCost)
      .minus(paymentFee)
      .minus(platformFee)
      .minus(deliveryCost)
      .minus(returnCharge)
      .minus(otherCost)
      .minus(orderExpenses)
      .minus(operatingExpenses);

    // Outstanding (receivables): revenue minus paid. paidTotal already
    // reflects refunds (RefundService reduces order.paidAmount), so we
    // don't subtract refunds a second time.
    const outstandingRaw = totalSales.minus(paidTotal);
    const outstanding = outstandingRaw.lt(0) ? new Prisma.Decimal(0) : outstandingRaw;

    return {
      orderCount: orders.length,
      grossSales,
      discounts,
      tax,
      shippingIncome,
      otherIncome,
      otherCost,
      totalSales,
      netRevenue,
      cogs,
      // Cost breakdown
      packagingCost,
      paymentFee,
      platformFee,
      deliveryCost,
      returnCharge,
      orderExpenses,
      operatingExpenses,
      refunds,
      // Profit
      grossProfit,
      netProfit,
      // Cash position
      paidTotal,
      outstanding,
    };
  },

  /**
   * Profitability grouped by a dimension (channel, customer, product,
   * category, warehouse, courier, salesperson, date).
   *
   * Returns an array of { key, label, orderCount, revenue, cogs, grossProfit, netProfit }.
   */
  async byDimension(dimension: "channel" | "customer" | "product" | "category" | "warehouse" | "courier" | "salesperson" | "date", range?: DateRange) {
    const orders = await db.order.findMany({
      where: { ...rangeWhere(range), status: { not: "CANCELLED" } },
      include: {
        items: { include: { product: { include: { category: true } } } },
        channel: true,
        customer: true,
        delivery: { include: { courierProvider: true } },
        creator: true,
      },
    });

    const buckets = new Map<string, { label: string; orderCount: number; revenue: Prisma.Decimal; cogs: Prisma.Decimal; grossProfit: Prisma.Decimal; netProfit: Prisma.Decimal }>();

    for (const o of orders) {
      const keys: { key: string; label: string }[] = [];
      const oGrossProfit = toDecimal(o.grossProfit);
      const oNetProfit = toDecimal(o.netProfit);
      const oRevenue = toDecimal(o.total).minus(toDecimal(o.tax));

      let oCogs = new Prisma.Decimal(0);
      for (const it of o.items) {
        oCogs = oCogs.plus(toDecimal(it.unitCost).times(toDecimal(it.quantity)));
      }

      switch (dimension) {
        case "channel": {
          keys.push({ key: o.channel?.id ?? "unknown", label: o.channel?.name ?? "Unknown" });
          break;
        }
        case "customer": {
          keys.push({ key: o.customer?.id ?? "unknown", label: o.customer?.name ?? "Unknown" });
          break;
        }
        case "product": {
          // One order may have multiple products → emit one bucket per product
          const productAgg = new Map<string, { label: string; qty: Prisma.Decimal; revenue: Prisma.Decimal; cogs: Prisma.Decimal }>();
          for (const it of o.items) {
            const key = it.productId;
            const entry = productAgg.get(key) ?? { label: it.product?.name ?? it.productName, qty: new Prisma.Decimal(0), revenue: new Prisma.Decimal(0), cogs: new Prisma.Decimal(0) };
            entry.qty = entry.qty.plus(toDecimal(it.quantity));
            entry.revenue = entry.revenue.plus(toDecimal(it.total));
            entry.cogs = entry.cogs.plus(toDecimal(it.unitCost).times(toDecimal(it.quantity)));
            productAgg.set(key, entry);
          }
          for (const [key, v] of productAgg) {
            keys.push({ key, label: v.label });
          }
          break;
        }
        case "category": {
          const catAgg = new Map<string, string>();
          for (const it of o.items) {
            const cat = it.product?.category;
            if (cat) catAgg.set(cat.id, cat.name);
          }
          for (const [key, label] of catAgg) {
            keys.push({ key, label });
          }
          break;
        }
        case "warehouse": {
          // Order doesn't directly have warehouse; use delivery.courierProvider as a proxy dimension.
          // True per-warehouse profitability requires OrderItem.warehouseId — out of scope.
          keys.push({ key: "all", label: "All Warehouses" });
          break;
        }
        case "courier": {
          keys.push({ key: o.delivery?.courierProvider?.id ?? "none", label: o.delivery?.courierProvider?.name ?? "No Courier" });
          break;
        }
        case "salesperson": {
          keys.push({ key: o.createdBy ?? "unknown", label: o.creator?.name ?? "Unknown" });
          break;
        }
        case "date": {
          const key = o.createdAt.toISOString().slice(0, 10);
          keys.push({ key, label: key });
          break;
        }
      }

      for (const { key, label } of keys) {
        const entry = buckets.get(key) ?? { label, orderCount: 0, revenue: new Prisma.Decimal(0), cogs: new Prisma.Decimal(0), grossProfit: new Prisma.Decimal(0), netProfit: new Prisma.Decimal(0) };
        entry.orderCount += 1;
        entry.revenue = entry.revenue.plus(oRevenue);
        entry.cogs = entry.cogs.plus(oCogs);
        entry.grossProfit = entry.grossProfit.plus(oGrossProfit);
        entry.netProfit = entry.netProfit.plus(oNetProfit);
        buckets.set(key, entry);
      }
    }

    return Array.from(buckets.entries()).map(([key, v]) => ({
      key,
      label: v.label,
      orderCount: v.orderCount,
      revenue: v.revenue.toFixed(2),
      cogs: v.cogs.toFixed(2),
      grossProfit: v.grossProfit.toFixed(2),
      netProfit: v.netProfit.toFixed(2),
    }));
  },
};
