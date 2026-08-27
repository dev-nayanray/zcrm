import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
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

    const rangeExpenseDate: Record<string, Date> = {};
    if (range.from) rangeExpenseDate.gte = range.from;
    if (range.to) rangeExpenseDate.lte = range.to;
    const where: Prisma.ExpenseWhereInput = {};
    if (Object.keys(rangeExpenseDate).length) where.expenseDate = rangeExpenseDate;

    const expenses = await db.expense.findMany({ where, include: { category: true, creator: { select: { name: true } } } });
    const total = expenses.reduce((s, e) => s.add(e.amount), new Prisma.Decimal(0));
    const byCategory = await AccountingService.expenseByCategory(range);
    const byDate = new Map<string, Prisma.Decimal>();
    for (const e of expenses) {
      const key = e.expenseDate.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? new Prisma.Decimal(0)).add(e.amount));
    }

    return ok({
      total: total.toFixed(2),
      count: expenses.length,
      byCategory,
      byDate: Array.from(byDate.entries()).map(([date, total]) => ({ date, total: total.toFixed(2) })),
      expenses: expenses.slice(0, 500).map((e) => ({ id: e.id, amount: e.amount.toFixed(2), category: e.category?.name, method: e.paymentMethod, description: e.description, expenseDate: e.expenseDate, createdBy: e.creator?.name })),
      range: { from: range.from?.toISOString(), to: range.to?.toISOString() },
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
