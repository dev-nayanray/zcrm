import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { csvResponse } from "@/lib/query";
import { resolveRange } from "@/lib/date-range";
import { AccountingService } from "@/lib/services/accounting";
import { InventoryService } from "@/lib/services/inventory";

type Ctx = { params: Promise<{ type: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("exports:read");
    if (err) return err;
    const { type } = await ctx.params;
    const sp = request.nextUrl.searchParams;
    const range = resolveRange(sp.get("preset") || undefined, sp.get("from") || undefined, sp.get("to") || undefined);

    switch (type) {
      case "orders": {
        const rangeCreatedAt: Record<string, Date> = {};
        if (range.from) rangeCreatedAt.gte = range.from;
        if (range.to) rangeCreatedAt.lte = range.to;
        const orders = await db.order.findMany({
          where: Object.keys(rangeCreatedAt).length ? { createdAt: rangeCreatedAt } : {},
          include: { customer: true, channel: true },
          orderBy: { createdAt: "desc" },
          take: 5000,
        });
        return csvResponse("orders.csv", orders.map((o) => ({
          orderNumber: o.orderNumber,
          date: o.createdAt.toISOString(),
          customer: o.customer.name,
          phone: o.customer.phone,
          channel: o.channel.name,
          status: o.status,
          paymentStatus: o.paymentStatus,
          subtotal: o.subtotal.toFixed(2),
          discount: o.discount.toFixed(2),
          shipping: o.shippingCost.toFixed(2),
          total: o.total.toFixed(2),
          paid: o.paidAmount.toFixed(2),
        })));
      }
      case "customers": {
        const customers = await db.customer.findMany({ include: { _count: { select: { orders: true } } }, take: 5000 });
        return csvResponse("customers.csv", customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, city: c.city, orders: c._count.orders, createdAt: c.createdAt.toISOString() })));
      }
      case "products": {
        const products = await db.product.findMany({ include: { inventory: true, category: true } });
        return csvResponse("products.csv", products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, category: p.category?.name, brand: p.brand, purchasePrice: p.purchasePrice.toFixed(2), sellingPrice: p.sellingPrice.toFixed(2), stock: p.inventory?.quantity?.toFixed(0) ?? 0, status: p.status })));
      }
      case "inventory": {
        const val = await InventoryService.stockValue();
        return csvResponse("inventory.csv", val.items);
      }
      case "purchases": {
        const purchases = await db.purchase.findMany({ include: { supplier: true, _count: { select: { items: true } } }, take: 5000 });
        return csvResponse("purchases.csv", purchases.map((p) => ({ purchaseNumber: p.purchaseNumber, date: p.createdAt.toISOString(), supplier: p.supplier.name, status: p.status, total: p.total.toFixed(2), paid: p.paidAmount.toFixed(2), due: p.dueAmount.toFixed(2), items: p._count.items })));
      }
      case "expenses": {
        const rangeExp: Record<string, Date> = {};
        if (range.from) rangeExp.gte = range.from;
        if (range.to) rangeExp.lte = range.to;
        const expenses = await db.expense.findMany({ where: Object.keys(rangeExp).length ? { expenseDate: rangeExp } : {}, include: { category: true }, take: 5000 });
        return csvResponse("expenses.csv", expenses.map((e) => ({ id: e.id, date: e.expenseDate.toISOString(), category: e.category.name, amount: e.amount.toFixed(2), method: e.paymentMethod, description: e.description, reference: e.reference })));
      }
      case "payments": {
        const rangeCreated: Record<string, Date> = {};
        if (range.from) rangeCreated.gte = range.from;
        if (range.to) rangeCreated.lte = range.to;
        const payments = await db.payment.findMany({ where: Object.keys(rangeCreated).length ? { createdAt: rangeCreated } : {}, include: { order: { select: { orderNumber: true } }, customer: { select: { name: true } } }, take: 5000 });
        return csvResponse("payments.csv", payments.map((p) => ({ id: p.id, date: p.createdAt.toISOString(), order: p.order.orderNumber, customer: p.customer.name, amount: p.amount.toFixed(2), method: p.method, reference: p.transactionReference })));
      }
      case "profit-loss": {
        const pnl = await AccountingService.profitAndLoss(range);
        return csvResponse("profit-loss.csv", [
          { line: "Gross Sales", amount: pnl.grossSales.toFixed(2) },
          { line: "Discounts", amount: pnl.discounts.toFixed(2) },
          { line: "Shipping", amount: pnl.shippingCost.toFixed(2) },
          { line: "Other Costs", amount: pnl.otherCost.toFixed(2) },
          { line: "Revenue", amount: pnl.revenue.toFixed(2) },
          { line: "Refunds", amount: pnl.refunds.toFixed(2) },
          { line: "Net Revenue", amount: pnl.netRevenue.toFixed(2) },
          { line: "COGS", amount: pnl.cogs.toFixed(2) },
          { line: "Gross Profit", amount: pnl.grossProfit.toFixed(2) },
          { line: "Operating Expenses", amount: pnl.operatingExpenses.toFixed(2) },
          { line: "Net Profit", amount: pnl.netProfit.toFixed(2) },
        ]);
      }
      default:
        return badRequest("Unknown export type");
    }
  } catch (e) {
    return serverError((e as Error).message);
  }
}
