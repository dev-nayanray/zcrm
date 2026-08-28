// Unit tests for the money minor-unit utility (Phase 4).
//
// These tests verify the conversion between major units (taka) and minor
// units (poisha) — the foundation of the Float→Int money migration.

import { Prisma } from "@prisma/client";
import { describe, test, expect } from "bun:test";
import { toMinor, fromMinor, minorToDisplay, toMoneySafe, formatMoney, roundMoney, sumMoney, backfillMinor, verifyMinorToFloat } from "@/lib/money";

const d = (n: number) => new Prisma.Decimal(n);

describe("money.ts — toMinor (taka → poisha)", () => {
  test("৳100.00 → 10000", () => {
    expect(toMinor(100)).toBe(10000);
  });
  test("৳100.50 → 10050", () => {
    expect(toMinor(100.5)).toBe(10050);
  });
  test("৳1999.99 → 199999", () => {
    expect(toMinor(1999.99)).toBe(199999);
  });
  test("৳0 → 0", () => {
    expect(toMinor(0)).toBe(0);
  });
  test("Decimal input works", () => {
    expect(toMinor(d(50.25))).toBe(5025);
  });
  test("String input works", () => {
    expect(toMinor("75.30")).toBe(7530);
  });
  test("null/undefined → 0", () => {
    expect(toMinor(null)).toBe(0);
    expect(toMinor(undefined)).toBe(0);
  });
  test("NaN → 0", () => {
    expect(toMinor(NaN)).toBe(0);
  });
  test("Negative amount preserved", () => {
    // Refunds can be negative in some accounting systems.
    expect(toMinor(-50.50)).toBe(-5050);
  });
  test("Large amount (৳1,000,000) → 100,000,000", () => {
    expect(toMinor(1_000_000)).toBe(100_000_000);
  });
});

describe("money.ts — fromMinor (poisha → taka)", () => {
  test("10000 → ৳100.00", () => {
    expect(fromMinor(10000).toFixed(2)).toBe("100.00");
  });
  test("10050 → ৳100.50", () => {
    expect(fromMinor(10050).toFixed(2)).toBe("100.50");
  });
  test("199999 → ৳1999.99", () => {
    expect(fromMinor(199999).toFixed(2)).toBe("1999.99");
  });
  test("0 → ৳0.00", () => {
    expect(fromMinor(0).toFixed(2)).toBe("0.00");
  });
  test("null → ৳0.00", () => {
    expect(fromMinor(null).toFixed(2)).toBe("0.00");
  });
});

describe("money.ts — round-trip conversion", () => {
  test("taka → minor → taka is lossless (2-decimal amounts)", () => {
    const amounts = [0, 0.01, 0.99, 1.00, 50.50, 100.00, 999.99, 1_000_000.00];
    for (const a of amounts) {
      const roundTrip = fromMinor(toMinor(a));
      expect(roundTrip.toFixed(2)).toBe(a.toFixed(2));
    }
  });
  test("minor → taka → minor is lossless", () => {
    const minors = [0, 1, 99, 100, 5050, 10000, 99999, 100000000];
    for (const m of minors) {
      const roundTrip = toMinor(fromMinor(m));
      expect(roundTrip).toBe(m);
    }
  });
});

describe("money.ts — minorToDisplay", () => {
  test("10050 → '100.50'", () => {
    expect(minorToDisplay(10050)).toBe("100.50");
  });
  test("0 → '0.00'", () => {
    expect(minorToDisplay(0)).toBe("0.00");
  });
  test("null → '0.00'", () => {
    expect(minorToDisplay(null)).toBe("0.00");
  });
});

describe("money.ts — toMoneySafe (Float write helper)", () => {
  test("Decimal → number", () => {
    expect(toMoneySafe(d(100.50))).toBe(100.5);
  });
  test("number → number", () => {
    expect(toMoneySafe(100.50)).toBe(100.5);
  });
  test("string → number", () => {
    expect(toMoneySafe("100.50")).toBe(100.5);
  });
  test("null → 0", () => {
    expect(toMoneySafe(null)).toBe(0);
  });
  test("NaN → 0", () => {
    expect(toMoneySafe(NaN)).toBe(0);
  });
  test("Infinity → 0 (defensive)", () => {
    expect(toMoneySafe(Infinity)).toBe(0);
  });
});

describe("money.ts — formatMoney", () => {
  test("Decimal → 2-decimal string", () => {
    expect(formatMoney(d(100.5))).toBe("100.50");
  });
  test("number → 2-decimal string", () => {
    expect(formatMoney(99.999)).toBe("100.00"); // rounds
  });
  test("null → '0.00'", () => {
    expect(formatMoney(null)).toBe("0.00");
  });
});

describe("money.ts — roundMoney", () => {
  test("Rounds to 2 decimals", () => {
    expect(roundMoney(100.555).toFixed(2)).toBe("100.56"); // ROUND_HALF_UP
  });
  test("100.5 stays 100.50", () => {
    expect(roundMoney(100.5).toFixed(2)).toBe("100.50");
  });
  test("Integer stays integer", () => {
    expect(roundMoney(100).toFixed(2)).toBe("100.00");
  });
});

describe("money.ts — sumMoney", () => {
  test("Sums a list of amounts", () => {
    expect(sumMoney([100, 200, 300]).toFixed(2)).toBe("600.00");
  });
  test("Skips null/undefined", () => {
    expect(sumMoney([100, null, undefined, 200]).toFixed(2)).toBe("300.00");
  });
  test("Empty array → 0.00", () => {
    expect(sumMoney([]).toFixed(2)).toBe("0.00");
  });
  test("Mixed Decimal + number + string", () => {
    expect(sumMoney([d(100), 50, "25.50"]).toFixed(2)).toBe("175.50");
  });
});

describe("money.ts — backfill helpers", () => {
  test("backfillMinor converts Float to minor units (cleaning drift)", () => {
    // 100.49999999999 (Float drift) → cleaned to 100.50 → 10050
    expect(backfillMinor(100.49999999999)).toBe(10050);
  });
  test("backfillMinor: 99.99 → 9999", () => {
    expect(backfillMinor(99.99)).toBe(9999);
  });
  test("backfillMinor: null → 0", () => {
    expect(backfillMinor(null)).toBe(0);
  });
  test("backfillMinor: NaN → 0", () => {
    expect(backfillMinor(NaN)).toBe(0);
  });
  test("verifyMinorToFloat: 10050 → 100.5", () => {
    expect(verifyMinorToFloat(10050)).toBe(100.5);
  });
  test("Round-trip: Float → minor → Float is lossless (after 2-decimal cleaning)", () => {
    const original = 99.99;
    const minor = backfillMinor(original);
    const restored = verifyMinorToFloat(minor);
    expect(restored.toFixed(2)).toBe(original.toFixed(2));
  });
});
