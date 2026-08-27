import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { AccountingService } from "@/lib/services/accounting";
import { resolveRange } from "@/lib/date-range";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("reports:read");
    if (err) return err;
    const sp = request.nextUrl.searchParams;
    const range = resolveRange(sp.get("preset") || undefined, sp.get("from") || undefined, sp.get("to") || undefined);
    const pnl = await AccountingService.profitAndLoss(range);
    return ok({
      ...pnl,
      grossSales: pnl.grossSales.toFixed(2),
      discounts: pnl.discounts.toFixed(2),
      shippingCost: pnl.shippingCost.toFixed(2),
      otherCost: pnl.otherCost.toFixed(2),
      revenue: pnl.revenue.toFixed(2),
      refunds: pnl.refunds.toFixed(2),
      netRevenue: pnl.netRevenue.toFixed(2),
      cogs: pnl.cogs.toFixed(2),
      grossProfit: pnl.grossProfit.toFixed(2),
      operatingExpenses: pnl.operatingExpenses.toFixed(2),
      netProfit: pnl.netProfit.toFixed(2),
      paidTotal: pnl.paidTotal.toFixed(2),
      outstanding: pnl.outstanding.toFixed(2),
      range: { from: range.from?.toISOString(), to: range.to?.toISOString() },
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
