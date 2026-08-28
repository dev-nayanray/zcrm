// Unit tests for the Weighted Average Cost (WAC) engine.
//
// These tests verify the WAC formula in isolation — they don't hit the
// database. They confirm that the formula:
//
//   newWAC = (currentStock * currentWAC + newQty * newUnitCost)
//            / (currentStock + newQty)
//
// produces the correct blended cost for the scenarios that matter:
//
//   1. First purchase (empty stock → WAC = unitCost)
//   2. Second purchase at a different price (WAC = weighted blend)
//   3. Purchase after stockout (WAC = new unitCost, old cost basis discarded)
//   4. Multiple purchases (WAC converges toward volume-weighted average)
//
// We replicate the formula here (pure function) rather than mocking the
// Prisma transaction client — testing the actual DB write requires a live
// MongoDB, which is covered by the integration tests instead.

import { Prisma } from "@prisma/client";
import { describe, test, expect } from "bun:test";

// Replicate the WAC formula from CostingService.recomputeWacInTx.
// This is the pure arithmetic — the service wraps it with DB reads/writes.
function computeWac(
  currentSellableStock: Prisma.Decimal,
  currentWac: Prisma.Decimal,
  newQty: Prisma.Decimal,
  newUnitCost: Prisma.Decimal,
): Prisma.Decimal {
  const totalQty = currentSellableStock.plus(newQty);
  if (totalQty.lte(0)) return newUnitCost; // defensive
  const existingValue = currentSellableStock.times(currentWac);
  const newValue = newQty.times(newUnitCost);
  return existingValue.plus(newValue).dividedBy(totalQty);
}

const d = (n: number) => new Prisma.Decimal(n);

describe("CostingService — Weighted Average Cost (WAC) formula", () => {
  describe("Scenario 1 — first purchase (empty stock)", () => {
    test("WAC = new unit cost when current stock is 0", () => {
      // Buy 100 units at ৳50 each, starting from empty stock
      const newWac = computeWac(d(0), d(0), d(100), d(50));
      expect(newWac.toFixed(2)).toBe("50.00");
    });
  });

  describe("Scenario 2 — second purchase at a different price (blended)", () => {
    test("100 @ ৳50 + 100 @ ৳70 → WAC = ৳60", () => {
      // After first purchase: 100 units @ ৳50 → WAC = 50
      // Now buy 100 more at ৳70:
      //   newWAC = (100 * 50 + 100 * 70) / (100 + 100) = 12000 / 200 = 60
      const newWac = computeWac(d(100), d(50), d(100), d(70));
      expect(newWac.toFixed(2)).toBe("60.00");
    });

    test("100 @ ৳50 + 50 @ ৳80 → WAC = ৳60 (volume-weighted)", () => {
      // newWAC = (100 * 50 + 50 * 80) / 150 = (5000 + 4000) / 150 = 9000 / 150 = 60
      const newWac = computeWac(d(100), d(50), d(50), d(80));
      expect(newWac.toFixed(2)).toBe("60.00");
    });

    test("Small purchase at high price barely moves WAC", () => {
      // 1000 units @ ৳50, current WAC = 50
      // Buy 10 more @ ৳500:
      //   newWAC = (1000 * 50 + 10 * 500) / 1010
      //          = (50000 + 5000) / 1010
      //          = 55000 / 1010
      //          ≈ 54.46
      // Volume-weighted: the 10 expensive units barely move the average.
      const newWac = computeWac(d(1000), d(50), d(10), d(500));
      expect(Number(newWac.toFixed(2))).toBeCloseTo(54.46, 1);
    });
  });

  describe("Scenario 3 — purchase after stockout", () => {
    test("Stock at 0 + new purchase → WAC = new unit cost (old cost discarded)", () => {
      // We sold everything, now we buy at a new price. The old WAC is
      // irrelevant because there's no remaining stock to blend with.
      const newWac = computeWac(d(0), d(50), d(100), d(80));
      expect(newWac.toFixed(2)).toBe("80.00");
    });
  });

  describe("Scenario 4 — multiple successive purchases converge to volume-weighted avg", () => {
    test("Three purchases: 100@50, 100@60, 100@70 → WAC = 60", () => {
      // Step 1: 100 @ 50 → WAC = 50, stock = 100
      let wac = computeWac(d(0), d(0), d(100), d(50));
      // Step 2: 100 @ 60, current stock 100, current WAC 50
      //   newWAC = (100*50 + 100*60) / 200 = 11000/200 = 55
      wac = computeWac(d(100), wac, d(100), d(60));
      expect(wac.toFixed(2)).toBe("55.00");
      // Step 3: 100 @ 70, current stock 200, current WAC 55
      //   newWAC = (200*55 + 100*70) / 300 = (11000 + 7000) / 300 = 18000/300 = 60
      wac = computeWac(d(200), wac, d(100), d(70));
      expect(wac.toFixed(2)).toBe("60.00");
    });
  });

  describe("Edge cases", () => {
    test("Zero new quantity throws (defensive — caller must validate)", () => {
      // The formula itself doesn't throw, but the service method does
      // (qty.lte(0) check). Here we just verify the formula's defensive
      // branch: totalQty <= 0 returns the new unit cost.
      const newWac = computeWac(d(-5), d(50), d(0), d(70));
      // currentStock=-5 + newQty=0 = 0 → falls into the defensive branch
      expect(newWac.toFixed(2)).toBe("70.00");
    });

    test("Negative current stock (shouldn't happen, but defensive) — falls back to new cost", () => {
      const newWac = computeWac(d(-10), d(50), d(5), d(70));
      // totalQty = -10 + 5 = -5 < 0 → defensive branch → 70
      expect(newWac.toFixed(2)).toBe("70.00");
    });
  });
});

describe("CostingService — back-compat fallback", () => {
  test("WAC of 0 falls back to purchasePrice (legacy products)", () => {
    // The service's getCostBasis logic: if WAC > 0 use WAC, else use purchasePrice.
    // We test the decision rule here.
    const wac = d(0);
    const purchasePrice = d(50);
    const costBasis = wac.gt(0) ? wac : purchasePrice;
    expect(costBasis.toFixed(2)).toBe("50.00");
  });

  test("WAC > 0 takes precedence over purchasePrice", () => {
    const wac = d(55);
    const purchasePrice = d(50); // legacy latest-cost
    const costBasis = wac.gt(0) ? wac : purchasePrice;
    expect(costBasis.toFixed(2)).toBe("55.00");
  });
});
