/**
 * Money Migration — Release 3 Verification Script
 *
 * Verifies that the integer minor-unit columns (*Minor) are consistent
 * with the Float columns across all monetary models. Run AFTER the
 * backfill script to confirm the migration is safe before switching reads.
 *
 * Usage:
 *   bun run scripts/verify-money.ts           # full verification
 *   bun run scripts/verify-money.ts --sample 50  # sample 50 rows per model
 *
 * Exit code 0 = all consistent. Exit code 1 = discrepancies found.
 */

import { PrismaClient } from "@prisma/client";
import { fromMinor } from "../src/lib/money";

const db = new PrismaClient();
const SAMPLE_SIZE = parseInt(process.argv[process.argv.indexOf("--sample") + 1] || "100", 10);

interface CheckResult {
  model: string;
  checked: number;
  consistent: number;
  discrepancies: number;
  sampleErrors: { id: string; floatVal: number; minorVal: number; restored: string }[];
}

async function checkOrder(): Promise<CheckResult> {
  const orders = await db.order.findMany({
    where: { totalMinor: { not: null } },
    take: SAMPLE_SIZE,
    select: { id: true, orderNumber: true, total: true, totalMinor: true, paidAmount: true, paidAmountMinor: true },
  });
  let consistent = 0;
  const errors: CheckResult["sampleErrors"] = [];
  for (const o of orders) {
    const totalOk = Math.abs(fromMinor(o.totalMinor!).toNumber() - o.total) < 0.01;
    const paidOk = o.paidAmountMinor !== null
      ? Math.abs(fromMinor(o.paidAmountMinor).toNumber() - o.paidAmount) < 0.01
      : true;
    if (totalOk && paidOk) {
      consistent++;
    } else {
      errors.push({
        id: o.orderNumber,
        floatVal: o.total,
        minorVal: o.totalMinor!,
        restored: fromMinor(o.totalMinor!).toFixed(2),
      });
    }
  }
  return { model: "Order", checked: orders.length, consistent, discrepancies: orders.length - consistent, sampleErrors: errors.slice(0, 5) };
}

async function checkPayment(): Promise<CheckResult> {
  const payments = await db.payment.findMany({
    where: { amountMinor: { not: null } },
    take: SAMPLE_SIZE,
    select: { id: true, amount: true, amountMinor: true },
  });
  let consistent = 0;
  const errors: CheckResult["sampleErrors"] = [];
  for (const p of payments) {
    const ok = Math.abs(fromMinor(p.amountMinor!).toNumber() - p.amount) < 0.01;
    if (ok) consistent++;
    else errors.push({ id: p.id, floatVal: p.amount, minorVal: p.amountMinor!, restored: fromMinor(p.amountMinor!).toFixed(2) });
  }
  return { model: "Payment", checked: payments.length, consistent, discrepancies: payments.length - consistent, sampleErrors: errors.slice(0, 5) };
}

async function checkPurchase(): Promise<CheckResult> {
  const purchases = await db.purchase.findMany({
    where: { totalMinor: { not: null } },
    take: SAMPLE_SIZE,
    select: { id: true, purchaseNumber: true, total: true, totalMinor: true },
  });
  let consistent = 0;
  const errors: CheckResult["sampleErrors"] = [];
  for (const p of purchases) {
    const ok = Math.abs(fromMinor(p.totalMinor!).toNumber() - p.total) < 0.01;
    if (ok) consistent++;
    else errors.push({ id: p.purchaseNumber, floatVal: p.total, minorVal: p.totalMinor!, restored: fromMinor(p.totalMinor!).toFixed(2) });
  }
  return { model: "Purchase", checked: purchases.length, consistent, discrepancies: purchases.length - consistent, sampleErrors: errors.slice(0, 5) };
}

async function checkExpense(): Promise<CheckResult> {
  const expenses = await db.expense.findMany({
    where: { amountMinor: { not: null } },
    take: SAMPLE_SIZE,
    select: { id: true, amount: true, amountMinor: true },
  });
  let consistent = 0;
  const errors: CheckResult["sampleErrors"] = [];
  for (const e of expenses) {
    const ok = Math.abs(fromMinor(e.amountMinor!).toNumber() - e.amount) < 0.01;
    if (ok) consistent++;
    else errors.push({ id: e.id, floatVal: e.amount, minorVal: e.amountMinor!, restored: fromMinor(e.amountMinor!).toFixed(2) });
  }
  return { model: "Expense", checked: expenses.length, consistent, discrepancies: expenses.length - consistent, sampleErrors: errors.slice(0, 5) };
}

async function main() {
  console.log(`Money verification — sampling up to ${SAMPLE_SIZE} rows per model...\n`);

  const results = await Promise.all([checkOrder(), checkPayment(), checkPurchase(), checkExpense()]);

  let totalDiscrepancies = 0;
  for (const r of results) {
    const status = r.discrepancies === 0 ? "✅" : "❌";
    console.log(`${status} ${r.model}: ${r.checked} checked, ${r.consistent} consistent, ${r.discrepancies} discrepancies`);
    if (r.sampleErrors.length > 0) {
      console.log(`   Sample errors:`);
      for (const e of r.sampleErrors) {
        console.log(`     ${e.id}: Float=${e.floatVal}, Minor=${e.minorVal}, Restored=${e.restored}`);
      }
    }
    totalDiscrepancies += r.discrepancies;
  }

  console.log(`\n${totalDiscrepancies === 0 ? "✅ All models consistent — safe to proceed to Release 4." : `❌ ${totalDiscrepancies} discrepancies found — investigate before switching reads.`}`);
  process.exit(totalDiscrepancies === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
