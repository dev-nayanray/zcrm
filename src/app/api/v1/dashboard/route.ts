import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { AccountingService } from "@/lib/services/accounting";
import { resolveRange } from "@/lib/date-range";
import { toDecimal } from "@/lib/decimal";
import { InventoryService } from "@/lib/services/inventory";
import { NotificationService } from "@/lib/services/notification";

export async function GET(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("dashboard:read");
    if (err) return err;

    const sp = request.nextUrl.searchParams;
    const preset = sp.get("preset") || "today";
    const from = sp.get("from") || undefined;
    const to = sp.get("to") || undefined;
    const range = resolveRange(preset, from, to);

    // Refresh system notifications opportunistically (low stock, failed sync)
    await NotificationService.refreshSystemNotifications();

    // ---- Today's KPIs (always today regardless of selected range) ----
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayRange = { from: todayStart, to: todayEnd };

    const todayOrdersAgg = await db.order.aggregate({
      where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { not: "CANCELLED" } },
      _sum: { total: true },
      _count: true,
    });
    const todayPaymentsAgg = await db.payment.aggregate({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
    });
    const todayExpensesAgg = await db.expense.aggregate({
      where: { expenseDate: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
    });

    // Today's profit: revenue - COGS - expenses (uses accounting model)
    const todayPnl = await AccountingService.profitAndLoss(todayRange);

    // ---- Selected-range P&L ----
    const pnl = await AccountingService.profitAndLoss(range);

    // ---- Monthly KPIs (this month) ----
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthRange = { from: monthStart, to: new Date() };
    const monthPnl = await AccountingService.profitAndLoss(monthRange);

    // ---- Order status counts within selected range ----
    const rangeCreatedAt: Record<string, Date> = {};
    if (range.from) rangeCreatedAt.gte = range.from;
    if (range.to) rangeCreatedAt.lte = range.to;
    const statusGroups = await db.order.groupBy({
      by: ["status"],
      where: Object.keys(rangeCreatedAt).length ? { createdAt: rangeCreatedAt } : {},
      _count: true,
    });
    const statusCount = (s: string) => statusGroups.find((g) => g.status === s)?._count ?? 0;

    const paymentStatusGroups = await db.order.groupBy({
      by: ["paymentStatus"],
      where: Object.keys(rangeCreatedAt).length ? { createdAt: rangeCreatedAt } : {},
      _count: true,
    });
    const payStatusCount = (s: string) => paymentStatusGroups.find((g) => g.paymentStatus === s)?._count ?? 0;

    // ---- Low & out of stock ----
    const allInv = await db.inventory.findMany({
      include: { product: { select: { name: true, sku: true, minimumStockLevel: true, status: true } } },
    });
    const lowStock = allInv.filter((i) => {
      const qty = new Prisma.Decimal(i.quantity);
      const min = new Prisma.Decimal(i.product.minimumStockLevel);
      return qty.gt(0) && qty.lte(min);
    });
    const outOfStock = allInv.filter((i) => new Prisma.Decimal(i.quantity).lte(0));

    // ---- Trends (last 30 days) ----
    const trend = await AccountingService.trend(30);

    // ---- Sales by channel & top products (selected range) ----
    const salesByChannel = await AccountingService.salesByChannel(range);
    const topProducts = await AccountingService.topProducts(range, 8);

    // ---- Stock valuation ----
    const stockValuation = await InventoryService.stockValue();

    return ok({
      range: { preset, from: range.from?.toISOString(), to: range.to?.toISOString() },
      kpis: {
        today: {
          sales: todayOrdersAgg._sum.total?.toFixed(2) ?? "0.00",
          orders: todayOrdersAgg._count,
          payments: todayPaymentsAgg._sum.amount?.toFixed(2) ?? "0.00",
          expenses: todayExpensesAgg._sum.amount?.toFixed(2) ?? "0.00",
          profit: todayPnl.netProfit.toFixed(2),
        },
        range: {
          revenue: pnl.revenue.toFixed(2),
          cogs: pnl.cogs.toFixed(2),
          grossProfit: pnl.grossProfit.toFixed(2),
          operatingExpenses: pnl.operatingExpenses.toFixed(2),
          netProfit: pnl.netProfit.toFixed(2),
          refunds: pnl.refunds.toFixed(2),
          orderCount: pnl.orderCount,
        },
        monthly: {
          revenue: monthPnl.revenue.toFixed(2),
          expenses: monthPnl.operatingExpenses.toFixed(2),
          profit: monthPnl.netProfit.toFixed(2),
        },
      },
      orderStatus: {
        pending: statusCount("PENDING"),
        confirmed: statusCount("CONFIRMED"),
        processing: statusCount("PROCESSING"),
        shipped: statusCount("SHIPPED"),
        delivered: statusCount("DELIVERED"),
        cancelled: statusCount("CANCELLED"),
        returned: statusCount("RETURNED"),
        refunded: statusCount("REFUNDED"),
      },
      paymentStatus: {
        unpaid: payStatusCount("UNPAID"),
        partial: payStatusCount("PARTIAL"),
        paid: payStatusCount("PAID"),
        refunded: payStatusCount("REFUNDED"),
      },
      lowStock: lowStock.map((i) => ({ productId: i.productId, name: i.product.name, sku: i.product.sku, quantity: i.quantity.toFixed(0), minimum: i.product.minimumStockLevel.toFixed(0) })),
      outOfStock: outOfStock.map((i) => ({ productId: i.productId, name: i.product.name, sku: i.product.sku })),
      trend,
      salesByChannel,
      topProducts,
      stockValue: { totalCost: stockValuation.totalCost, totalRetail: stockValuation.totalRetail, itemCount: stockValuation.items.length },
      user: { id: user!.id, name: user!.name, role: user!.role.name },
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
