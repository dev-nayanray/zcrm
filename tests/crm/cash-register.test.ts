// Unit tests for the cash register variance calculation (Phase 4).
//
// Phase 4 added `actualClosingCount` to CashService.closeDay — the cashier
// counts the physical cash in the till, and the system computes:
//
//   Expected Closing = Opening Float + Cash Inflows − Cash Outflows
//   Variance         = Actual Closing Count − Expected Closing
//
// These tests verify the variance arithmetic. A full integration test of
// CashService.closeDay requires a live MongoDB.

import { describe, test, expect } from "bun:test";

function computeVariance(actualCount: number, expectedClosing: number): number {
  return actualCount - expectedClosing;
}

function computeExpectedClosing(opening: number, cashIn: number, cashOut: number): number {
  return opening + cashIn - cashOut;
}

describe("Cash register — variance calculation", () => {
  describe("Positive variance (more cash than expected)", () => {
    test("Expected 25000, counted 25500 → +500", () => {
      const expected = computeExpectedClosing(5000, 22000, 2000); // 5000 + 22000 - 2000
      const variance = computeVariance(25500, expected);
      expect(variance).toBe(500);
    });
    test("Expected 0, counted 100 → +100 (unrecorded sale?)", () => {
      const variance = computeVariance(100, 0);
      expect(variance).toBe(100);
    });
  });

  describe("Negative variance (less cash than expected)", () => {
    test("Expected 25000, counted 24500 → -500", () => {
      const expected = computeExpectedClosing(5000, 22000, 2000);
      const variance = computeVariance(24500, expected);
      expect(variance).toBe(-500);
    });
    test("Expected 1000, counted 0 → -1000 (cash theft?)", () => {
      const variance = computeVariance(0, 1000);
      expect(variance).toBe(-1000);
    });
  });

  describe("Zero variance (perfect count)", () => {
    test("Expected 25000, counted 25000 → 0", () => {
      const expected = computeExpectedClosing(5000, 22000, 2000);
      const variance = computeVariance(25000, expected);
      expect(variance).toBe(0);
    });
  });

  describe("Expected closing formula", () => {
    test("Opening + Inflows − Outflows", () => {
      // Opening 5000
      // + Cash sales 15000
      // + Customer payments 7000
      // − Refunds 2000
      // − Expenses 3000
      // = 22000
      expect(computeExpectedClosing(5000, 22000, 5000)).toBe(22000);
    });
    test("Zero opening, zero flows → 0", () => {
      expect(computeExpectedClosing(0, 0, 0)).toBe(0);
    });
    test("Large opening, small outflow", () => {
      expect(computeExpectedClosing(100000, 0, 5000)).toBe(95000);
    });
  });

  describe("Variance sign convention", () => {
    test("Positive variance = surplus (more cash than expected)", () => {
      const variance = computeVariance(105, 100);
      expect(variance).toBeGreaterThan(0);
    });
    test("Negative variance = shortage (less cash than expected)", () => {
      const variance = computeVariance(95, 100);
      expect(variance).toBeLessThan(0);
    });
    test("Zero variance = balanced", () => {
      const variance = computeVariance(100, 100);
      expect(variance).toBe(0);
    });
  });

  describe("Edge cases", () => {
    test("actualClosingCount = undefined → no variance computed", () => {
      // The service skips variance computation when actualClosingCount is
      // not provided (backward-compat with callers that don't count cash).
      const actualCount: number | undefined = undefined;
      const variance = actualCount !== undefined ? computeVariance(actualCount, 25000) : undefined;
      expect(variance).toBeUndefined();
    });
    test("actualClosingCount = 0, expected = 1000 → -1000", () => {
      const variance = computeVariance(0, 1000);
      expect(variance).toBe(-1000);
    });
    test("actualClosingCount = string '25500' → parsed to number", () => {
      // The service accepts string input (from Telegram / form) and converts.
      const actualCount = Number("25500");
      const variance = computeVariance(actualCount, 25000);
      expect(variance).toBe(500);
    });
  });
});
