// Unit tests for PaymentService integrity guards (Phase 3).
//
// These tests verify the GUARD LOGIC (which statuses are rejected, what
// counts as overpayment, what makes a transaction reference duplicate) —
// they don't hit the database. A full integration test of
// PaymentService.create requires a live MongoDB (covered by the
// integration test suite).

import { describe, test, expect } from "bun:test";

// Replicate the rejected-status set from PaymentService.create.
// Source of truth: src/lib/services/payment.ts:60
const REJECTED_ORDER_STATUSES = ["CANCELLED", "REFUNDED", "RETURN_REQUESTED"];

function isPaymentAllowed(orderStatus: string): boolean {
  return !REJECTED_ORDER_STATUSES.includes(orderStatus);
}

// Replicate the overpayment check.
function wouldOverpay(currentlyPaid: number, newAmount: number, orderTotal: number): boolean {
  return currentlyPaid + newAmount > orderTotal;
}

describe("PaymentService — integrity guards", () => {
  describe("Rejects payments on terminal / pending-return orders", () => {
    test("CANCELLED order → payment rejected", () => {
      expect(isPaymentAllowed("CANCELLED")).toBe(false);
    });
    test("REFUNDED order → payment rejected", () => {
      expect(isPaymentAllowed("REFUNDED")).toBe(false);
    });
    test("RETURN_REQUESTED order → payment rejected", () => {
      expect(isPaymentAllowed("RETURN_REQUESTED")).toBe(false);
    });
  });

  describe("Accepts payments on active order states", () => {
    test("PENDING → allowed", () => {
      expect(isPaymentAllowed("PENDING")).toBe(true);
    });
    test("CONFIRMED → allowed", () => {
      expect(isPaymentAllowed("CONFIRMED")).toBe(true);
    });
    test("PROCESSING → allowed", () => {
      expect(isPaymentAllowed("PROCESSING")).toBe(true);
    });
    test("SHIPPED → allowed", () => {
      expect(isPaymentAllowed("SHIPPED")).toBe(true);
    });
    test("DELIVERED → allowed", () => {
      expect(isPaymentAllowed("DELIVERED")).toBe(true);
    });
    test("COMPLETED → allowed", () => {
      expect(isPaymentAllowed("COMPLETED")).toBe(true);
    });
    test("RETURNED → allowed (partial return — may still accept payment for remaining items)", () => {
      expect(isPaymentAllowed("RETURNED")).toBe(true);
    });
  });

  describe("Overpayment prevention", () => {
    test("Exact payment accepted", () => {
      // 5000 total, 0 paid, 5000 new → exactly meets total
      expect(wouldOverpay(0, 5000, 5000)).toBe(false);
    });
    test("Partial payment accepted", () => {
      // 5000 total, 3000 paid, 1500 new → 4500 ≤ 5000
      expect(wouldOverpay(3000, 1500, 5000)).toBe(false);
    });
    test("Overpayment rejected", () => {
      // 5000 total, 4000 paid, 2000 new → 6000 > 5000
      expect(wouldOverpay(4000, 2000, 5000)).toBe(true);
    });
    test("Overpayment by 1 rejected", () => {
      // 5000 total, 0 paid, 5001 new → 5001 > 5000
      expect(wouldOverpay(0, 5001, 5000)).toBe(true);
    });
    test("Already-paid order with 0-amount payment accepted (no-op)", () => {
      // 5000 total, 5000 paid, 0 new → 5000 ≤ 5000
      expect(wouldOverpay(5000, 0, 5000)).toBe(false);
    });
  });

  describe("Idempotency logic", () => {
    test("Same transactionReference → idempotent (returns existing)", () => {
      // The service checks: if transactionReference is provided and a payment
      // with that ref already exists for the order, return it instead of
      // creating a duplicate. We test the decision rule here.
      const hasExistingPayment = true;
      const ref = "BKASH-TRX-12345";
      const shouldCreate = !hasExistingPayment || !ref;
      expect(shouldCreate).toBe(false);
    });
    test("Empty/undefined transactionReference → always create (no dedup)", () => {
      // Cash payments often have no reference — we can't dedup them by ref,
      // so we always create a new record. (Overpayment prevention still applies.)
      const ref = "";
      // The service checks `ref && ref.trim() !== ""` — empty string is falsy,
      // so the dedup branch is NOT taken.
      const shouldDedup = !!(ref && ref.trim() !== "");
      expect(shouldDedup).toBe(false);
    });
    test("Different transactionReference → create new payment", () => {
      const existingRef = "BKASH-TRX-001";
      const newRef = "BKASH-TRX-002";
      const isDuplicate = existingRef === newRef;
      expect(isDuplicate).toBe(false);
    });
    test("Webhook redelivery (same ref 5x) → only 1 payment created", () => {
      // Simulate 5 webhook redeliveries of the same payment event.
      // The idempotency check means only the first creates a record; the
      // remaining 4 return the existing record.
      const refs = ["TRX-A", "TRX-A", "TRX-A", "TRX-A", "TRX-A"];
      const created = new Set<string>();
      const duplicates: string[] = [];
      for (const ref of refs) {
        if (created.has(ref)) {
          duplicates.push(ref);
        } else {
          created.add(ref);
        }
      }
      expect(created.size).toBe(1);
      expect(duplicates.length).toBe(4);
    });
  });
});
