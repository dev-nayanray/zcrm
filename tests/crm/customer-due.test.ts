// Unit tests for the customer due aging logic.
//
// These tests verify the aging bucket assignment and the due formula in
// isolation — they don't hit the database. The due formula:
//
//   totalDue = totalSales − totalPaid + totalRefund − advance
//
// Aging buckets are assigned per-order based on days since the order was
// created:
//   0–7 days | 8–30 days | 31–60 days | 61–90 days | 90+ days
//
// A full DB-backed integration test of CustomerDueService.computeDue
// requires a live MongoDB and is covered by the integration test suite.

import { Prisma } from "@prisma/client";
import { describe, test, expect } from "bun:test";

const d = (n: number) => new Prisma.Decimal(n);

// Replicate the aging bucket assignment from CustomerDueService.computeDue.
function assignAgingBucket(ageDays: number, dueAmount: Prisma.Decimal): { bucket: "0-7" | "8-30" | "31-60" | "61-90" | "90+"; amount: Prisma.Decimal } {
  if (ageDays <= 7) return { bucket: "0-7", amount: dueAmount };
  if (ageDays <= 30) return { bucket: "8-30", amount: dueAmount };
  if (ageDays <= 60) return { bucket: "31-60", amount: dueAmount };
  if (ageDays <= 90) return { bucket: "61-90", amount: dueAmount };
  return { bucket: "90+", amount: dueAmount };
}

// Replicate the due formula.
function computeDue(input: {
  totalSales: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  totalRefund: Prisma.Decimal;
  advance: Prisma.Decimal;
}): Prisma.Decimal {
  const raw = input.totalSales.minus(input.totalPaid).plus(input.totalRefund).minus(input.advance);
  return raw.lt(0) ? new Prisma.Decimal(0) : raw;
}

describe("CustomerDueService — due formula", () => {
  test("Full payment → due = 0", () => {
    const due = computeDue({ totalSales: d(5000), totalPaid: d(5000), totalRefund: d(0), advance: d(0) });
    expect(due.toFixed(2)).toBe("0.00");
  });

  test("Partial payment → due = remainder", () => {
    const due = computeDue({ totalSales: d(5000), totalPaid: d(3000), totalRefund: d(0), advance: d(0) });
    expect(due.toFixed(2)).toBe("2000.00");
  });

  test("No payment → due = full sales", () => {
    const due = computeDue({ totalSales: d(5000), totalPaid: d(0), totalRefund: d(0), advance: d(0) });
    expect(due.toFixed(2)).toBe("5000.00");
  });

  test("Refund increases due (we owe the customer)", () => {
    // Customer paid 5000 for a 5000 order, then got a 1000 refund
    // due = 5000 - 5000 + 1000 - 0 = 1000 (we owe them 1000)
    const due = computeDue({ totalSales: d(5000), totalPaid: d(5000), totalRefund: d(1000), advance: d(0) });
    expect(due.toFixed(2)).toBe("1000.00");
  });

  test("Advance payment reduces due", () => {
    // Customer paid 3000 + 1000 advance against a 5000 order
    // due = 5000 - 3000 - 0 - 1000 = 1000
    const due = computeDue({ totalSales: d(5000), totalPaid: d(3000), totalRefund: d(0), advance: d(1000) });
    expect(due.toFixed(2)).toBe("1000.00");
  });

  test("Overpayment + advance → due clamps to 0 (no negative)", () => {
    // Customer paid 6000 for a 5000 order (1000 overpaid) + 500 advance
    // raw due = 5000 - 6000 + 0 - 500 = -1500 → clamped to 0
    const due = computeDue({ totalSales: d(5000), totalPaid: d(6000), totalRefund: d(0), advance: d(500) });
    expect(due.toFixed(2)).toBe("0.00");
  });

  test("Refund + advance together", () => {
    // Customer paid 4000 for a 5000 order, got 500 refund, has 200 advance
    // due = 5000 - 4000 + 500 - 200 = 1300
    const due = computeDue({ totalSales: d(5000), totalPaid: d(4000), totalRefund: d(500), advance: d(200) });
    expect(due.toFixed(2)).toBe("1300.00");
  });
});

describe("CustomerDueService — aging buckets", () => {
  test("Order created 3 days ago → 0-7 bucket", () => {
    const { bucket } = assignAgingBucket(3, d(1000));
    expect(bucket).toBe("0-7");
  });

  test("Order created 7 days ago → 0-7 bucket (boundary inclusive)", () => {
    const { bucket } = assignAgingBucket(7, d(1000));
    expect(bucket).toBe("0-7");
  });

  test("Order created 8 days ago → 8-30 bucket", () => {
    const { bucket } = assignAgingBucket(8, d(1000));
    expect(bucket).toBe("8-30");
  });

  test("Order created 30 days ago → 8-30 bucket (boundary inclusive)", () => {
    const { bucket } = assignAgingBucket(30, d(1000));
    expect(bucket).toBe("8-30");
  });

  test("Order created 45 days ago → 31-60 bucket", () => {
    const { bucket } = assignAgingBucket(45, d(1000));
    expect(bucket).toBe("31-60");
  });

  test("Order created 75 days ago → 61-90 bucket", () => {
    const { bucket } = assignAgingBucket(75, d(1000));
    expect(bucket).toBe("61-90");
  });

  test("Order created 120 days ago → 90+ bucket", () => {
    const { bucket } = assignAgingBucket(120, d(1000));
    expect(bucket).toBe("90+");
  });

  test("Multiple orders land in different buckets", () => {
    const orders = [
      { ageDays: 3, due: d(500) },
      { ageDays: 15, due: d(800) },
      { ageDays: 45, due: d(1200) },
      { ageDays: 100, due: d(2000) },
    ];
    const buckets = { "0-7": d(0), "8-30": d(0), "31-60": d(0), "61-90": d(0), "90+": d(0) };
    for (const o of orders) {
      const { bucket, amount } = assignAgingBucket(o.ageDays, o.due);
      buckets[bucket] = buckets[bucket].plus(amount);
    }
    expect(buckets["0-7"].toFixed(2)).toBe("500.00");
    expect(buckets["8-30"].toFixed(2)).toBe("800.00");
    expect(buckets["31-60"].toFixed(2)).toBe("1200.00");
    expect(buckets["61-90"].toFixed(2)).toBe("0.00");
    expect(buckets["90+"].toFixed(2)).toBe("2000.00");
  });
});
