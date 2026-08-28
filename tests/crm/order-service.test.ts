// Unit tests for the pure functions in OrderService.
//
// These tests do NOT hit the database — they verify the order-status state
// machine, which is the most error-prone piece of business logic in the
// order service. Database-backed tests live in `acceptance.test.ts` and
// `integration.test.ts` (which require a running server).

import { validateOrderStatusTransition } from "@/lib/services/order";
import { describe, test, expect } from "bun:test";

describe("OrderService.validateOrderStatusTransition", () => {
  describe("allows forward transitions within the workflow", () => {
    test("PENDING → CONFIRMED", () => {
      expect(() => validateOrderStatusTransition("PENDING", "CONFIRMED")).not.toThrow();
    });
    test("PENDING → CANCELLED", () => {
      expect(() => validateOrderStatusTransition("PENDING", "CANCELLED")).not.toThrow();
    });
    test("CONFIRMED → PROCESSING", () => {
      expect(() => validateOrderStatusTransition("CONFIRMED", "PROCESSING")).not.toThrow();
    });
    test("PROCESSING → SHIPPED", () => {
      expect(() => validateOrderStatusTransition("PROCESSING", "SHIPPED")).not.toThrow();
    });
    test("SHIPPED → DELIVERED", () => {
      expect(() => validateOrderStatusTransition("SHIPPED", "DELIVERED")).not.toThrow();
    });
    test("DELIVERED → RETURNED", () => {
      expect(() => validateOrderStatusTransition("DELIVERED", "RETURNED")).not.toThrow();
    });
    test("RETURNED → REFUNDED", () => {
      expect(() => validateOrderStatusTransition("RETURNED", "REFUNDED")).not.toThrow();
    });
  });

  describe("is idempotent on same-status transitions", () => {
    test("PENDING → PENDING is a no-op", () => {
      expect(() => validateOrderStatusTransition("PENDING", "PENDING")).not.toThrow();
    });
    test("DELIVERED → DELIVERED is a no-op", () => {
      expect(() => validateOrderStatusTransition("DELIVERED", "DELIVERED")).not.toThrow();
    });
  });

  describe("rejects backward transitions", () => {
    test("DELIVERED → PROCESSING throws", () => {
      expect(() => validateOrderStatusTransition("DELIVERED", "PROCESSING")).toThrow();
    });
    test("SHIPPED → PENDING throws", () => {
      expect(() => validateOrderStatusTransition("SHIPPED", "PENDING")).toThrow();
    });
    test("CONFIRMED → PENDING throws", () => {
      expect(() => validateOrderStatusTransition("CONFIRMED", "PENDING")).toThrow();
    });
  });

  describe("rejects transitions out of terminal states", () => {
    test("CANCELLED → DELIVERED throws", () => {
      expect(() => validateOrderStatusTransition("CANCELLED", "DELIVERED")).toThrow(/terminal/i);
    });
    test("REFUNDED → DELIVERED throws", () => {
      expect(() => validateOrderStatusTransition("REFUNDED", "DELIVERED")).toThrow(/terminal/i);
    });
    test("CANCELLED → CONFIRMED throws", () => {
      expect(() => validateOrderStatusTransition("CANCELLED", "CONFIRMED")).toThrow();
    });
  });
});
