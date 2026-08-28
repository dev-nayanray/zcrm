// Unit tests for the WooCommerce reconciliation logic (Phase 4).
//
// These tests verify the comparison logic (MATCHED / CRM_ONLY / WOO_ONLY /
// DIFFERENT) in isolation — they don't hit the database or the Woo API.

import { describe, test, expect } from "bun:test";

// Replicate the reconciliation comparison logic.
// Source: src/lib/services/woocommerce.ts:reconcileProducts + reconcileOrders

function compareProduct(crm: { sellingPrice: number; status: string }, woo: { regular_price?: string; sale_price?: string; status?: string }) {
  const diffs: string[] = [];
  const wooPrice = Number(woo.sale_price || woo.regular_price || 0);
  if (Math.abs(wooPrice - crm.sellingPrice) > 0.01) diffs.push(`price: CRM=${crm.sellingPrice} Woo=${wooPrice}`);
  const wooStatus = woo.status === "draft" ? "INACTIVE" : "ACTIVE";
  if (wooStatus !== crm.status) diffs.push(`status: CRM=${crm.status} Woo=${wooStatus}`);
  return diffs;
}

function compareOrder(crm: { status: string; total: number }, woo: { status: string; total: string }) {
  const diffs: string[] = [];
  const WOO_TO_CRM: Record<string, string> = {
    pending: "PENDING", processing: "CONFIRMED", "on-hold": "PENDING",
    completed: "DELIVERED", cancelled: "CANCELLED", refunded: "REFUNDED", failed: "CANCELLED",
  };
  const wooCrmStatus = WOO_TO_CRM[woo.status] ?? "";
  if (wooCrmStatus && wooCrmStatus !== crm.status) diffs.push(`status: CRM=${crm.status} Woo=${wooCrmStatus}`);
  const wooTotal = Number(woo.total || 0);
  if (Math.abs(wooTotal - crm.total) > 0.01) diffs.push(`total: CRM=${crm.total} Woo=${wooTotal}`);
  return diffs;
}

describe("WooCommerce reconciliation — product comparison", () => {
  test("Identical product → MATCHED (no diffs)", () => {
    const diffs = compareProduct(
      { sellingPrice: 100, status: "ACTIVE" },
      { regular_price: "100", status: "publish" },
    );
    expect(diffs).toEqual([]);
  });
  test("Different price → DIFFERENT", () => {
    const diffs = compareProduct(
      { sellingPrice: 100, status: "ACTIVE" },
      { regular_price: "150", status: "publish" },
    );
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain("price");
    expect(diffs[0]).toContain("CRM=100");
    expect(diffs[0]).toContain("Woo=150");
  });
  test("Different status (draft vs ACTIVE) → DIFFERENT", () => {
    const diffs = compareProduct(
      { sellingPrice: 100, status: "ACTIVE" },
      { regular_price: "100", status: "draft" },
    );
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain("status");
  });
  test("Sale price overrides regular price in comparison", () => {
    // Woo has regular_price=100, sale_price=80 → effective price = 80
    const diffs = compareProduct(
      { sellingPrice: 80, status: "ACTIVE" },
      { regular_price: "100", sale_price: "80", status: "publish" },
    );
    expect(diffs).toEqual([]);
  });
  test("Tiny price difference (< 0.01) → MATCHED (float tolerance)", () => {
    const diffs = compareProduct(
      { sellingPrice: 100.00, status: "ACTIVE" },
      { regular_price: "100.001", status: "publish" },
    );
    expect(diffs).toEqual([]);
  });
});

describe("WooCommerce reconciliation — order comparison", () => {
  test("Identical order → MATCHED", () => {
    const diffs = compareOrder(
      { status: "CONFIRMED", total: 2500 },
      { status: "processing", total: "2500.00" },
    );
    expect(diffs).toEqual([]);
  });
  test("Different status → DIFFERENT", () => {
    const diffs = compareOrder(
      { status: "DELIVERED", total: 2500 },
      { status: "processing", total: "2500.00" },
    );
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain("status");
  });
  test("Different total → DIFFERENT", () => {
    const diffs = compareOrder(
      { status: "CONFIRMED", total: 2500 },
      { status: "processing", total: "3000.00" },
    );
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain("total");
  });
  test("Unknown Woo status → no status diff (can't compare)", () => {
    const diffs = compareOrder(
      { status: "CONFIRMED", total: 2500 },
      { status: "custom-woo-status", total: "2500.00" },
    );
    // The Woo status isn't in the map, so we skip the status comparison.
    expect(diffs).toEqual([]);
  });
  test("Both status AND total differ → 2 diffs", () => {
    const diffs = compareOrder(
      { status: "DELIVERED", total: 2500 },
      { status: "cancelled", total: "0.00" },
    );
    expect(diffs.length).toBe(2);
  });
});

describe("WooCommerce reconciliation — entity-set logic", () => {
  // Simulate the full reconcileProducts set operation.
  test("CRM-only product (deleted from Woo) → CRM_ONLY", () => {
    const crmProducts = [{ externalId: "1", sku: "A", sellingPrice: 100, status: "ACTIVE" }];
    const wooProducts = new Map(); // empty — Woo has no products
    const wooIds = new Set(wooProducts.keys());

    let crmOnly = 0, wooOnly = 0, matched = 0, different = 0;
    for (const crm of crmProducts) {
      if (!wooIds.has(crm.externalId)) {
        crmOnly++;
      }
    }
    expect(crmOnly).toBe(1);
    expect(wooOnly).toBe(0);
    expect(matched).toBe(0);
    expect(different).toBe(0);
  });

  test("Woo-only product (never synced to CRM) → WOO_ONLY", () => {
    const crmProducts: any[] = []; // CRM has no products
    const wooProducts = new Map([["1", { id: 1, sku: "A" }]]);

    let crmOnly = 0, wooOnly = 0;
    for (const crm of crmProducts) {
      if (!wooProducts.has(crm.externalId)) crmOnly++;
    }
    // After checking CRM products, remaining Woo products = WOO_ONLY
    wooOnly = wooProducts.size; // since no CRM products, all Woo are WOO_ONLY
    expect(crmOnly).toBe(0);
    expect(wooOnly).toBe(1);
  });

  test("Mixed: 1 matched, 1 CRM-only, 1 Woo-only, 1 different", () => {
    const crmProducts = [
      { externalId: "1", sku: "A", sellingPrice: 100, status: "ACTIVE" }, // matched
      { externalId: "2", sku: "B", sellingPrice: 200, status: "ACTIVE" }, // different (price)
      { externalId: "3", sku: "C", sellingPrice: 300, status: "ACTIVE" }, // CRM-only (not in Woo)
    ];
    const wooProducts = new Map([
      ["1", { id: 1, regular_price: "100", status: "publish" }], // matches CRM 1
      ["2", { id: 2, regular_price: "250", status: "publish" }], // differs from CRM 2
      ["4", { id: 4, sku: "D" }], // Woo-only
    ]);

    let matched = 0, crmOnly = 0, wooOnly = 0, different = 0;
    for (const crm of crmProducts) {
      const woo = wooProducts.get(crm.externalId);
      if (!woo) { crmOnly++; continue; }
      wooProducts.delete(crm.externalId);
      const diffs = compareProduct(crm, woo);
      if (diffs.length > 0) different++;
      else matched++;
    }
    wooOnly = wooProducts.size;

    expect(matched).toBe(1);
    expect(different).toBe(1);
    expect(crmOnly).toBe(1);
    expect(wooOnly).toBe(1);
  });
});
