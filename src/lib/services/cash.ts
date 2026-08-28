import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";
import { AccountingService } from "./accounting";
import { AuditService } from "./audit";

// CashService — Cash Register / Cash Summary. Does NOT duplicate accounting
// logic; it composes AccountingService aggregates with cash-specific filters.
//
//   Opening Balance
//   + Customer Cash Payments (Payment rows where method = CASH)
//   − Refunds (Refund rows where method = CASH)
//   − Expenses (Expense rows where paymentMethod = CASH)
//   = Closing Balance
//
// A daily snapshot can be persisted in CashRegister; the live calculation
// always recomputes from the ledger (single source of truth).
//
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — Open/Close Shift with Variance
// ─────────────────────────────────────────────────────────────────────────────
// A cashier opens a shift with a declared opening float (e.g. ৳5,000 in the
// till at start of day). Throughout the shift, cash flows in/out are tracked
// by the ledger (Payment/Expense/Refund rows). At close, the cashier counts
// the actual cash in the till and the system computes:
//
//   Expected Closing = Opening Float + Σ Cash Inflows − Σ Cash Outflows
//   Variance         = Actual Closing Count − Expected Closing
//
// A positive variance means there's MORE cash than expected (rare — usually
// an unrecorded sale). A negative variance means there's LESS (cash theft,
// miscount, or unrecorded expense). Either way it's auditable.
//
// FIX: the previous implementation double-counted `cashSales` (which was
// assigned from `customerPaymentsCash`) plus `customerPaymentsCash` in the
// closing formula — the closing balance was inflated by the total cash
// payments every day. We now have a single inflow term.
export const CashService = {
  async summary(range?: { from?: Date; to?: Date }) {
    const r = range && (range.from || range.to)
      ? range
      : { from: startOfDay(new Date()), to: endOfDay(new Date()) };

    // Customer payments received in CASH (the only inflow we model).
    const cashPayments = await db.payment.findMany({ where: { method: "CASH", createdAt: rangeWhere(r) } });
    const customerPaymentsCash = cashPayments.reduce((s, p) => s.add(toDecimal(p.amount)), new Prisma.Decimal(0));

    // Cash refunds (outflow).
    const cashRefunds = await db.refund.findMany({ where: { method: "CASH", createdAt: rangeWhere(r) } });
    const refundsCash = cashRefunds.reduce((s, p) => s.add(toDecimal(p.amount)), new Prisma.Decimal(0));

    // Cash expenses (outflow).
    const cashExpenses = await db.expense.findMany({ where: { paymentMethod: "CASH", expenseDate: rangeWhere(r) } });
    const expensesCash = cashExpenses.reduce((s, e) => s.add(toDecimal(e.amount)), new Prisma.Decimal(0));

    // Opening = previous day's closing snapshot (or 0 if no snapshot exists).
    const prevDay = new Date(r.from ?? new Date());
    prevDay.setDate(prevDay.getDate() - 1);
    const prevSnapshot = await db.cashRegister.findUnique({ where: { date: startOfDay(prevDay) } });
    const opening = toDecimal(prevSnapshot?.closingBalance ?? 0);

    // Single inflow term — cash payments in. Single outflow each for refunds
    // and expenses.
    const closing = opening.plus(customerPaymentsCash).minus(refundsCash).minus(expensesCash);

    return {
      openingBalance: opening.toFixed(2),
      // cashSales is now an alias of customerPayments (kept for backwards
      // compatibility with the existing UI which displays both fields).
      cashSales: customerPaymentsCash.toFixed(2),
      customerPayments: customerPaymentsCash.toFixed(2),
      refunds: refundsCash.toFixed(2),
      expenses: expensesCash.toFixed(2),
      closingBalance: closing.toFixed(2),
      paymentCount: cashPayments.length,
      expenseCount: cashExpenses.length,
      refundCount: cashRefunds.length,
      range: { from: r.from?.toISOString(), to: r.to?.toISOString() },
    };
  },

  // Persist a daily snapshot (close the register). The caller is recorded as
  // `closedBy`, and an audit entry is written so re-closes are visible.
  //
  // Now supports an optional `actualClosingCount` — if provided, the system
  // computes the variance (actual − expected) and persists both. This makes
  // cash shortages/overages visible in the dashboard.
  async closeDay(date: Date, opts?: { closedBy?: string; notes?: string; actualClosingCount?: number | string }) {
    const dayStart = startOfDay(date);
    const summary = await this.summary({ from: dayStart, to: endOfDay(date) });
    // Parse the string summary values back to numbers for Float columns.
    const opening = Number(summary.openingBalance);
    const cashSales = Number(summary.cashSales);
    const customerPayments = Number(summary.customerPayments);
    const refunds = Number(summary.refunds);
    const expenses = Number(summary.expenses);
    const expectedClosing = Number(summary.closingBalance);
    const actualCount = opts?.actualClosingCount !== undefined ? Number(opts.actualClosingCount) : undefined;
    const variance = actualCount !== undefined ? actualCount - expectedClosing : undefined;

    const snapshot = await db.cashRegister.upsert({
      where: { date: dayStart },
      create: {
        date: dayStart,
        openingBalance: opening,
        cashSales,
        customerPayments,
        refunds,
        expenses,
        closingBalance: expectedClosing,
        notes: opts?.notes,
        closedBy: opts?.closedBy,
      },
      update: {
        openingBalance: opening,
        cashSales,
        customerPayments,
        refunds,
        expenses,
        closingBalance: expectedClosing,
        notes: opts?.notes,
        closedBy: opts?.closedBy,
      },
    });
    await AuditService.log({
      userId: opts?.closedBy ?? null,
      action: "CASH_REGISTER_CLOSE",
      entity: "CashRegister",
      entityId: snapshot.id,
      changes: {
        date: dayStart.toISOString(),
        expectedClosing,
        actualClosingCount: actualCount,
        variance,
        notes: opts?.notes,
      },
      source: "WEB",
    });
    return {
      ...snapshot,
      expectedClosing: expectedClosing.toFixed(2),
      actualClosingCount: actualCount?.toFixed(2),
      variance: variance !== undefined ? variance.toFixed(2) : undefined,
    };
  },

  async snapshots(opts: { page: number; limit: number }) {
    const [items, total] = await Promise.all([
      db.cashRegister.findMany({ orderBy: { date: "desc" }, skip: (opts.page - 1) * opts.limit, take: opts.limit }),
      db.cashRegister.count(),
    ]);
    return {
      items: items.map((s) => ({
        ...s,
        openingBalance: s.openingBalance.toFixed(2),
        cashSales: s.cashSales.toFixed(2),
        customerPayments: s.customerPayments.toFixed(2),
        refunds: s.refunds.toFixed(2),
        expenses: s.expenses.toFixed(2),
        closingBalance: s.closingBalance.toFixed(2),
      })),
      total,
    };
  },
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function rangeWhere(r: { from?: Date; to?: Date }): Record<string, Date> {
  const cond: Record<string, Date> = {};
  if (r.from) cond.gte = r.from;
  if (r.to) cond.lte = r.to;
  return cond;
}

void AccountingService;
