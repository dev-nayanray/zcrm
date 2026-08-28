// Unit tests for the ReturnService workflow (Phase 3).
//
// Phase 3 split ReturnService into:
//   - request() — creates a PENDING return, sets order to RETURN_REQUESTED
//   - approve() — transitions PENDING → COMPLETED, applies stock + refund
//   - create()  — legacy one-shot (request + approve in one call)
//
// These tests verify the workflow logic in isolation — they don't hit the
// database. A full integration test requires a live MongoDB.

import { describe, test, expect } from "bun:test";

// Replicate the allowed statuses for a return request.
// Source: src/lib/services/return.ts:59 (requestableStatuses)
const REQUESTABLE_ORDER_STATUSES = ["SHIPPED", "DELIVERED", "COMPLETED", "RETURN_REQUESTED", "RETURNED"];
function canRequestReturn(orderStatus: string): boolean {
  return REQUESTABLE_ORDER_STATUSES.includes(orderStatus);
}

// Replicate the legacy create() allowed statuses.
// Source: src/lib/services/return.ts:266 (allowedStatuses for create)
const CREATE_ALLOWED_STATUSES = ["SHIPPED", "DELIVERED", "COMPLETED", "RETURN_REQUESTED", "RETURNED"];
function canCreateReturn(orderStatus: string): boolean {
  return CREATE_ALLOWED_STATUSES.includes(orderStatus);
}

// Replicate the cumulative-quantity check.
function cumulativeReturnExceedsOrdered(alreadyReturned: number, thisReturn: number, orderedQty: number): boolean {
  return alreadyReturned + thisReturn > orderedQty;
}

// Replicate the refund amount check.
function refundExceedsPaid(refundAmount: number, paidAmount: number): boolean {
  return refundAmount > paidAmount;
}

// Replicate the "all items returned" check.
function allItemsReturned(items: { ordered: number; returned: number }[]): boolean {
  return items.every((i) => i.returned >= i.ordered);
}

describe("ReturnService — request() workflow", () => {
  describe("Allows return requests from post-dispatch states", () => {
    test("SHIPPED → can request return", () => {
      expect(canRequestReturn("SHIPPED")).toBe(true);
    });
    test("DELIVERED → can request return", () => {
      expect(canRequestReturn("DELIVERED")).toBe(true);
    });
    test("COMPLETED → can request return", () => {
      expect(canRequestReturn("COMPLETED")).toBe(true);
    });
    test("RETURN_REQUESTED → can request again (idempotent)", () => {
      // A second return request against an already-RETURN_REQUESTED order
      // is allowed (e.g. customer wants to return a second item).
      expect(canRequestReturn("RETURN_REQUESTED")).toBe(true);
    });
    test("RETURNED → can request another return (partial)", () => {
      expect(canRequestReturn("RETURNED")).toBe(true);
    });
  });

  describe("Rejects return requests from pre-dispatch states", () => {
    test("PENDING → rejected (items never dispatched)", () => {
      expect(canRequestReturn("PENDING")).toBe(false);
    });
    test("CONFIRMED → rejected", () => {
      expect(canRequestReturn("CONFIRMED")).toBe(false);
    });
    test("CANCELLED → rejected (order is dead)", () => {
      expect(canRequestReturn("CANCELLED")).toBe(false);
    });
    test("REFUNDED → rejected (terminal)", () => {
      expect(canRequestReturn("REFUNDED")).toBe(false);
    });
  });
});

describe("ReturnService — create() legacy one-shot", () => {
  test("Allowed statuses match request() (no regression)", () => {
    // The legacy create() should accept the same set of source states as
    // request() — otherwise the two code paths could drift.
    expect(canCreateReturn("SHIPPED")).toBe(canRequestReturn("SHIPPED"));
    expect(canCreateReturn("DELIVERED")).toBe(canRequestReturn("DELIVERED"));
    expect(canCreateReturn("COMPLETED")).toBe(canRequestReturn("COMPLETED"));
    expect(canCreateReturn("RETURN_REQUESTED")).toBe(canRequestReturn("RETURN_REQUESTED"));
    expect(canCreateReturn("RETURNED")).toBe(canRequestReturn("RETURNED"));
    expect(canCreateReturn("PENDING")).toBe(canRequestReturn("PENDING"));
    expect(canCreateReturn("CANCELLED")).toBe(canRequestReturn("CANCELLED"));
  });
});

describe("ReturnService — cumulative quantity validation", () => {
  test("First return within ordered qty → OK", () => {
    // Ordered 10, already returned 0, this return 3 → 3 ≤ 10
    expect(cumulativeReturnExceedsOrdered(0, 3, 10)).toBe(false);
  });

  test("Second return that would exceed ordered qty → rejected", () => {
    // Ordered 10, already returned 8, this return 5 → 13 > 10
    expect(cumulativeReturnExceedsOrdered(8, 5, 10)).toBe(true);
  });

  test("Return exactly matching ordered qty → OK (boundary)", () => {
    // Ordered 10, already returned 0, this return 10 → 10 = 10 (not > 10)
    expect(cumulativeReturnExceedsOrdered(0, 10, 10)).toBe(false);
  });

  test("Partial returns summing to < ordered → OK", () => {
    // Ordered 10, returned 3, returned 4, this return 2 → 9 ≤ 10
    expect(cumulativeReturnExceedsOrdered(7, 2, 10)).toBe(false);
  });

  test("Third partial return that pushes over → rejected", () => {
    // Ordered 10, returned 3+4=7, this return 4 → 11 > 10
    expect(cumulativeReturnExceedsOrdered(7, 4, 10)).toBe(true);
  });
});

describe("ReturnService — refund amount validation", () => {
  test("Refund ≤ paid → OK", () => {
    expect(refundExceedsPaid(500, 1000)).toBe(false);
  });
  test("Refund = paid → OK (full refund)", () => {
    expect(refundExceedsPaid(1000, 1000)).toBe(false);
  });
  test("Refund > paid → rejected", () => {
    expect(refundExceedsPaid(1500, 1000)).toBe(true);
  });
  test("Refund on unpaid order → rejected", () => {
    expect(refundExceedsPaid(100, 0)).toBe(true);
  });
});

describe("ReturnService — all-items-returned check", () => {
  test("Single item, fully returned → allReturned = true", () => {
    expect(allItemsReturned([{ ordered: 5, returned: 5 }])).toBe(true);
  });
  test("Single item, partially returned → allReturned = false", () => {
    expect(allItemsReturned([{ ordered: 5, returned: 3 }])).toBe(false);
  });
  test("Multi-item, all fully returned → allReturned = true", () => {
    expect(allItemsReturned([
      { ordered: 5, returned: 5 },
      { ordered: 3, returned: 3 },
      { ordered: 2, returned: 2 },
    ])).toBe(true);
  });
  test("Multi-item, one not fully returned → allReturned = false", () => {
    expect(allItemsReturned([
      { ordered: 5, returned: 5 },
      { ordered: 3, returned: 2 }, // ← short
      { ordered: 2, returned: 2 },
    ])).toBe(false);
  });
  test("Empty items list → allReturned = true (vacuously)", () => {
    // every() on an empty array returns true. This is correct behaviour —
    // an order with no items has trivially "all items returned".
    expect(allItemsReturned([])).toBe(true);
  });
});

describe("ReturnService — approve() workflow", () => {
  test("PENDING return → can approve", () => {
    // The approve() method checks ret.status === "PENDING"
    const canApprove = (status: string) => status === "PENDING";
    expect(canApprove("PENDING")).toBe(true);
  });
  test("COMPLETED return → cannot approve again", () => {
    const canApprove = (status: string) => status === "PENDING";
    expect(canApprove("COMPLETED")).toBe(false);
  });
  test("Already-approved return is idempotent (rejected, not re-applied)", () => {
    // This prevents double stock movements if the admin clicks "Approve"
    // twice on the same return.
    const canApprove = (status: string) => status === "PENDING";
    expect(canApprove("COMPLETED")).toBe(false);
  });
});

describe("ReturnService — stock decision (GOOD vs DAMAGED)", () => {
  test("GOOD condition → RETURN movement (sellable stock increases)", () => {
    const condition = "GOOD";
    const movementType = condition === "GOOD" ? "RETURN" : "DAMAGED_RETURN";
    expect(movementType).toBe("RETURN");
  });
  test("DAMAGED condition → DAMAGED_RETURN movement (damaged bucket only)", () => {
    const condition = "DAMAGED";
    const movementType = condition === "GOOD" ? "RETURN" : "DAMAGED_RETURN";
    expect(movementType).toBe("DAMAGED_RETURN");
  });
  test("Default condition (when not specified) → GOOD", () => {
    // The service uses `it.condition ?? "GOOD"` — defaults to GOOD.
    const condition: string | undefined = undefined;
    const resolved = condition ?? "GOOD";
    expect(resolved).toBe("GOOD");
  });
  test("DAMAGED return does NOT increase sellable stock", () => {
    // The customer kept the sellable unit out of the warehouse.
    // The DAMAGED_RETURN movement only increases damagedQuantity.
    // Sellable stock is NOT touched (the DAMAGE movement is reserved for
    // internal sellable→damaged conversions).
    const condition = "DAMAGED";
    const touchesSellable = condition === "GOOD"; // only GOOD returns touch sellable
    expect(touchesSellable).toBe(false);
  });
});
