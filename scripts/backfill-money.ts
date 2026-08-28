/**
 * Money Migration — Release 2 Backfill Script
 *
 * Populates the new integer minor-unit columns (*Minor) on the Order model
 * from the existing Float columns. Safe to run multiple times — only
 * backfills rows where the *Minor column is null.
 *
 * Usage:
 *   bun run scripts/backfill-money.ts           # live run
 *   bun run scripts/backfill-money.ts --dry-run # dry run (no writes)
 *
 * Formula: 10050 (minor) = 100.50 (float) × 100, rounded to nearest integer.
 * Uses backfillMinor() from src/lib/money.ts which cleans float drift
 * (e.g. 100.49999999999 → 100.50 → 10050) before converting.
 *
 * Rollback: the *Minor columns are nullable. To roll back, run:
 *   db.order.updateMany({ data: { totalMinor: null, paidAmountMinor: null, ... } })
 * This clears the minor columns without affecting the Float columns.
 */

import { PrismaClient } from "@prisma/client";
import { backfillMinor } from "../src/lib/money";

const db = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`Money backfill ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} — starting...`);

  // Find all orders where any *Minor column is null (needs backfill).
  const orders = await db.order.findMany({
    where: {
      OR: [
        { totalMinor: null },
        { paidAmountMinor: null },
        { cogsTotalMinor: null },
        { grossProfitMinor: null },
        { netProfitMinor: null },
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      paidAmount: true,
      cogsTotal: true,
      grossProfit: true,
      netProfit: true,
    },
  });

  console.log(`Found ${orders.length} orders to backfill.`);

  if (DRY_RUN) {
    // Show a sample of what would be written.
    const sample = orders.slice(0, 5);
    for (const o of sample) {
      console.log(`  ${o.orderNumber}: total=${o.total} → totalMinor=${backfillMinor(o.total)}`);
    }
    console.log(`\nDry run complete. ${orders.length} orders would be updated.`);
    return;
  }

  let updated = 0;
  let errors = 0;

  for (const o of orders) {
    try {
      await db.order.update({
        where: { id: o.id },
        data: {
          totalMinor: backfillMinor(o.total),
          paidAmountMinor: backfillMinor(o.paidAmount),
          cogsTotalMinor: backfillMinor(o.cogsTotal),
          grossProfitMinor: backfillMinor(o.grossProfit),
          netProfitMinor: backfillMinor(o.netProfit),
        },
      });
      updated++;
    } catch (e) {
      errors++;
      console.error(`  Error backfilling ${o.orderNumber}:`, (e as Error).message);
    }
  }

  console.log(`\nBackfill complete: ${updated} updated, ${errors} errors.`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
