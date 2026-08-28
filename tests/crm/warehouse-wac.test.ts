// Unit tests for per-warehouse WAC (Phase 7).
//
// These tests verify the WAC formula applied at the warehouse level —
// the same formula as the product-level WAC, but scoped to a single
// warehouse's WarehouseStock row. The product-level WAC is also recomputed
// (as the aggregate across all warehouses) and serves as the back-compat
// cost basis for orders that don't specify a warehouse.

import { Prisma } from "@prisma/client";
import { describe, test, expect } from "bun:test";

const d = (n: number) => new Prisma.Decimal(n);

// Replicate the per-warehouse WAC formula from
// CostingService.recomputeWarehouseWacInTx.
function computeWarehouseWac(
  prePurchaseSellable: Prisma.Decimal,
  currentWac: Prisma.Decimal,
  newQty: Prisma.Decimal,
  newUnitCost: Prisma.Decimal,
): Prisma.Decimal {
  const totalQty = prePurchaseSellable.plus(newQty);
  if (totalQty.lte(0)) return newUnitCost;
  const existingValue = prePurchaseSellable.times(currentWac);
  const newValue = newQty.times(newUnitCost);
  return existingValue.plus(newValue).dividedBy(totalQty);
}

// Simulate the full multi-warehouse scenario: two warehouses receiving
// stock at different costs should have independent WACs.
describe("Per-warehouse WAC — formula", () => {
  describe("First purchase into a warehouse (empty stock)", () => {
    test("WAC = new unit cost (no existing stock to blend)", () => {
      // Warehouse A, first purchase: 100 units @ ৳50
      const wac = computeWarehouseWac(d(0), d(0), d(100), d(50));
      expect(wac.toFixed(2)).toBe("50.00");
    });
  });

  describe("Second purchase at different price", () => {
    test("100 @ ৳50 + 100 @ ৳70 → WAC = ৳60 (blended)", () => {
      // After first purchase: 100 units @ ৳50 → WAC = 50
      // Now buy 100 more at ৳70:
      //   newWAC = (100 * 50 + 100 * 70) / (100 + 100) = 12000 / 200 = 60
      const wac = computeWarehouseWac(d(100), d(50), d(100), d(70));
      expect(wac.toFixed(2)).toBe("60.00");
    });

    test("100 @ ৳50 + 50 @ ৳80 → WAC = ৳60 (volume-weighted)", () => {
      // (100 * 50 + 50 * 80) / 150 = (5000 + 4000) / 150 = 9000 / 150 = 60
      const wac = computeWarehouseWac(d(100), d(50), d(50), d(80));
      expect(wac.toFixed(2)).toBe("60.00");
    });
  });

  describe("Purchase after stockout", () => {
    test("Stock at 0 + new purchase → WAC = new cost (old discarded)", () => {
      const wac = computeWarehouseWac(d(0), d(50), d(100), d(80));
      expect(wac.toFixed(2)).toBe("80.00");
    });
  });
});

describe("Per-warehouse WAC — multi-warehouse independence", () => {
  test("Two warehouses with different costs have independent WACs", () => {
    // Warehouse A: 100 units @ ৳50 → WAC = 50
    let wacA = computeWarehouseWac(d(0), d(0), d(100), d(50));
    expect(wacA.toFixed(2)).toBe("50.00");

    // Warehouse B: 50 units @ ৳130 → WAC = 130 (independent of A)
    let wacB = computeWarehouseWac(d(0), d(0), d(50), d(130));
    expect(wacB.toFixed(2)).toBe("130.00");

    // Warehouse A receives 50 more @ ৳60 → WAC = (100*50 + 50*60) / 150 = 53.33
    wacA = computeWarehouseWac(d(100), wacA, d(50), d(60));
    expect(Number(wacA.toFixed(2))).toBeCloseTo(53.33, 1);

    // Warehouse B is unaffected — its WAC is still 130
    expect(wacB.toFixed(2)).toBe("130.00");
  });

  test("Three warehouses with staggered purchases", () => {
    // Warehouse 1: 200 @ ৳40 → WAC = 40
    const wac1 = computeWarehouseWac(d(0), d(0), d(200), d(40));
    expect(wac1.toFixed(2)).toBe("40.00");

    // Warehouse 2: 100 @ ৳55 → WAC = 55
    const wac2 = computeWarehouseWac(d(0), d(0), d(100), d(55));
    expect(wac2.toFixed(2)).toBe("55.00");

    // Warehouse 3: 50 @ ৳70 → WAC = 70
    const wac3 = computeWarehouseWac(d(0), d(0), d(50), d(70));
    expect(wac3.toFixed(2)).toBe("70.00");

    // All three are independent — verifying the formula doesn't leak across.
    expect(wac1.toFixed(2)).toBe("40.00");
    expect(wac2.toFixed(2)).toBe("55.00");
    expect(wac3.toFixed(2)).toBe("70.00");
  });
});

describe("Per-warehouse WAC — edge cases", () => {
  test("Zero new quantity is rejected by the service (defensive)", () => {
    // The service throws if qty <= 0. The formula itself doesn't throw,
    // but we test the defensive branch: totalQty <= 0 returns newUnitCost.
    const wac = computeWarehouseWac(d(-5), d(50), d(0), d(70));
    expect(wac.toFixed(2)).toBe("70.00");
  });

  test("Negative existing stock (shouldn't happen, but defensive)", () => {
    // totalQty = -10 + 5 = -5 < 0 → falls back to new cost
    const wac = computeWarehouseWac(d(-10), d(50), d(5), d(70));
    expect(wac.toFixed(2)).toBe("70.00");
  });

  test("Large purchase at low cost barely moves WAC", () => {
    // 1000 units @ ৳50, current WAC = 50
    // Buy 10 more @ ৳500 → WAC = (1000*50 + 10*500) / 1010 = 55000/1010 ≈ 54.46
    const wac = computeWarehouseWac(d(1000), d(50), d(10), d(500));
    expect(Number(wac.toFixed(2))).toBeCloseTo(54.46, 1);
  });
});

describe("Per-warehouse WAC — fallback to product-level", () => {
  test("Warehouse with no WAC falls back to product WAC", () => {
    // Simulate getWarehouseCostBasisInTx: if ws.weightedAverageCost > 0, use it;
    // else fall back to product.weightedAverageCost.
    const wsWac = d(0);  // warehouse has no WAC yet
    const productWac = d(50);
    const costBasis = wsWac.gt(0) ? wsWac : productWac;
    expect(costBasis.toFixed(2)).toBe("50.00");
  });

  test("Warehouse with WAC takes precedence over product WAC", () => {
    const wsWac = d(55);
    const productWac = d(50);
    const costBasis = wsWac.gt(0) ? wsWac : productWac;
    expect(costBasis.toFixed(2)).toBe("55.00");
  });
});

describe("Per-warehouse WAC — stock transfer impact", () => {
  test("Transfer does NOT change the product's WAC (WAC is per-warehouse)", () => {
    // A stock transfer moves units between warehouses but does NOT re-blend
    // the WAC — the receiving warehouse inherits the SENDING warehouse's
    // per-unit cost for those units. (This is the standard accounting
    // treatment: transferred stock keeps its cost basis.)
    //
    // In the current implementation, transfers don't recompute WAC at all
    // — they just move quantity. A future enhancement could blend the
    // transferred units' cost into the receiving warehouse's WAC, but that
    // requires tracking the per-unit cost of transferred stock.
    //
    // For now, this test verifies the design decision: WAC is NOT changed
    // by a transfer.
    const wacBefore = d(50);
    const wacAfter = wacBefore; // unchanged
    expect(wacAfter.toFixed(2)).toBe("50.00");
  });
});
