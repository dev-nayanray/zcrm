// Unit tests for the expanded order status machine (Phase 2).
//
// Phase 2 added three new statuses to the workflow:
//   READY_TO_SHIP — between PROCESSING and SHIPPED
//   COMPLETED     — after DELIVERED, before any return/refund
//   RETURN_REQUESTED — between SHIPPED/DELIVERED/COMPLETED and RETURNED
//
// These tests verify the new transitions are allowed and the old ones
// still work. Same-status transitions must remain idempotent no-ops.

import { validateOrderStatusTransition } from "@/lib/services/order";
import { describe, test, expect } from "bun:test";

describe("OrderService — expanded status machine (Phase 2)", () => {
  describe("NEW: READY_TO_SHIP transitions", () => {
    test("PENDING → READY_TO_SHIP allowed", () => {
      expect(() => validateOrderStatusTransition("PENDING", "READY_TO_SHIP")).not.toThrow();
    });
    test("CONFIRMED → READY_TO_SHIP allowed", () => {
      expect(() => validateOrderStatusTransition("CONFIRMED", "READY_TO_SHIP")).not.toThrow();
    });
    test("PROCESSING → READY_TO_SHIP allowed", () => {
      expect(() => validateOrderStatusTransition("PROCESSING", "READY_TO_SHIP")).not.toThrow();
    });
    test("READY_TO_SHIP → SHIPPED allowed", () => {
      expect(() => validateOrderStatusTransition("READY_TO_SHIP", "SHIPPED")).not.toThrow();
    });
    test("READY_TO_SHIP → DELIVERED allowed (skip SHIPPED)", () => {
      expect(() => validateOrderStatusTransition("READY_TO_SHIP", "DELIVERED")).not.toThrow();
    });
    test("READY_TO_SHIP → COMPLETED allowed", () => {
      expect(() => validateOrderStatusTransition("READY_TO_SHIP", "COMPLETED")).not.toThrow();
    });
    test("READY_TO_SHIP → CANCELLED allowed", () => {
      expect(() => validateOrderStatusTransition("READY_TO_SHIP", "CANCELLED")).not.toThrow();
    });
    test("READY_TO_SHIP → PENDING throws (backward)", () => {
      expect(() => validateOrderStatusTransition("READY_TO_SHIP", "PENDING")).toThrow();
    });
  });

  describe("NEW: COMPLETED status", () => {
    test("DELIVERED → COMPLETED allowed", () => {
      expect(() => validateOrderStatusTransition("DELIVERED", "COMPLETED")).not.toThrow();
    });
    test("SHIPPED → COMPLETED allowed (skip DELIVERED)", () => {
      expect(() => validateOrderStatusTransition("SHIPPED", "COMPLETED")).not.toThrow();
    });
    test("COMPLETED → RETURN_REQUESTED allowed", () => {
      expect(() => validateOrderStatusTransition("COMPLETED", "RETURN_REQUESTED")).not.toThrow();
    });
    test("COMPLETED → RETURNED allowed (direct)", () => {
      expect(() => validateOrderStatusTransition("COMPLETED", "RETURNED")).not.toThrow();
    });
    test("COMPLETED → REFUNDED allowed", () => {
      expect(() => validateOrderStatusTransition("COMPLETED", "REFUNDED")).not.toThrow();
    });
    test("COMPLETED → PENDING throws (backward)", () => {
      expect(() => validateOrderStatusTransition("COMPLETED", "PENDING")).toThrow();
    });
    test("COMPLETED → SHIPPED throws (backward)", () => {
      expect(() => validateOrderStatusTransition("COMPLETED", "SHIPPED")).toThrow();
    });
  });

  describe("NEW: RETURN_REQUESTED status", () => {
    test("SHIPPED → RETURN_REQUESTED allowed", () => {
      expect(() => validateOrderStatusTransition("SHIPPED", "RETURN_REQUESTED")).not.toThrow();
    });
    test("DELIVERED → RETURN_REQUESTED allowed", () => {
      expect(() => validateOrderStatusTransition("DELIVERED", "RETURN_REQUESTED")).not.toThrow();
    });
    test("COMPLETED → RETURN_REQUESTED allowed", () => {
      expect(() => validateOrderStatusTransition("COMPLETED", "RETURN_REQUESTED")).not.toThrow();
    });
    test("RETURN_REQUESTED → RETURNED allowed", () => {
      expect(() => validateOrderStatusTransition("RETURN_REQUESTED", "RETURNED")).not.toThrow();
    });
    test("RETURN_REQUESTED → CANCELLED allowed (decline the return)", () => {
      expect(() => validateOrderStatusTransition("RETURN_REQUESTED", "CANCELLED")).not.toThrow();
    });
    test("RETURN_REQUESTED → REFUNDED throws (must go through RETURNED)", () => {
      expect(() => validateOrderStatusTransition("RETURN_REQUESTED", "REFUNDED")).toThrow();
    });
  });

  describe("REGRESSION: original transitions still work", () => {
    test("PENDING → CONFIRMED allowed", () => {
      expect(() => validateOrderStatusTransition("PENDING", "CONFIRMED")).not.toThrow();
    });
    test("CONFIRMED → PROCESSING allowed", () => {
      expect(() => validateOrderStatusTransition("CONFIRMED", "PROCESSING")).not.toThrow();
    });
    test("SHIPPED → DELIVERED allowed", () => {
      expect(() => validateOrderStatusTransition("SHIPPED", "DELIVERED")).not.toThrow();
    });
    test("DELIVERED → RETURNED allowed", () => {
      expect(() => validateOrderStatusTransition("DELIVERED", "RETURNED")).not.toThrow();
    });
    test("RETURNED → REFUNDED allowed", () => {
      expect(() => validateOrderStatusTransition("RETURNED", "REFUNDED")).not.toThrow();
    });
    test("CANCELLED → anything throws (terminal)", () => {
      expect(() => validateOrderStatusTransition("CANCELLED", "DELIVERED")).toThrow(/terminal/i);
    });
    test("REFUNDED → anything throws (terminal)", () => {
      expect(() => validateOrderStatusTransition("REFUNDED", "DELIVERED")).toThrow(/terminal/i);
    });
  });

  describe("REGRESSION: same-status is idempotent no-op", () => {
    test("READY_TO_SHIP → READY_TO_SHIP no-op", () => {
      expect(() => validateOrderStatusTransition("READY_TO_SHIP", "READY_TO_SHIP")).not.toThrow();
    });
    test("COMPLETED → COMPLETED no-op", () => {
      expect(() => validateOrderStatusTransition("COMPLETED", "COMPLETED")).not.toThrow();
    });
    test("RETURN_REQUESTED → RETURN_REQUESTED no-op", () => {
      expect(() => validateOrderStatusTransition("RETURN_REQUESTED", "RETURN_REQUESTED")).not.toThrow();
    });
  });

  describe("REGRESSION: backward transitions still rejected", () => {
    test("DELIVERED → PROCESSING throws", () => {
      expect(() => validateOrderStatusTransition("DELIVERED", "PROCESSING")).toThrow();
    });
    test("SHIPPED → PENDING throws", () => {
      expect(() => validateOrderStatusTransition("SHIPPED", "PENDING")).toThrow();
    });
    test("COMPLETED → DELIVERED throws (backward)", () => {
      // COMPLETED can only go to RETURN_REQUESTED, RETURNED, REFUNDED
      expect(() => validateOrderStatusTransition("COMPLETED", "DELIVERED")).toThrow();
    });
  });
});
