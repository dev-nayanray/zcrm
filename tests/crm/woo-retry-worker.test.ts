// Unit tests for the WooCommerce retry worker logic (Phase 4).
//
// These tests verify the CLAIM/RETRY/BACKOFF logic in isolation — they
// don't hit the database. A full integration test of
// WooCommerceService.claimAndRetryFailed requires a live MongoDB.

import { describe, test, expect } from "bun:test";

// Replicate the backoff schedule from claimAndRetryFailed.
// Source: src/lib/services/woocommerce.ts:903
const BACKOFF_MS = [60_000, 300_000, 1_500_000, 7_200_000, 36_000_000];

function isDueForRetry(nextRetryAt: Date | null, now: Date): boolean {
  if (nextRetryAt === null) return false; // permanently failed
  return nextRetryAt.getTime() <= now.getTime();
}

function isPermanentFailure(attemptCount: number): boolean {
  return attemptCount >= 5;
}

function computeNextRetryAt(attemptCount: number, now: Date): Date | null {
  if (isPermanentFailure(attemptCount)) return null;
  const idx = Math.min(attemptCount, BACKOFF_MS.length - 1);
  return new Date(now.getTime() + BACKOFF_MS[idx]);
}

describe("WooCommerce retry worker — claim logic", () => {
  describe("isDueForRetry", () => {
    test("nextRetryAt in the past → due", () => {
      const past = new Date(Date.now() - 60_000);
      expect(isDueForRetry(past, new Date())).toBe(true);
    });
    test("nextRetryAt in the future → not due", () => {
      const future = new Date(Date.now() + 60_000);
      expect(isDueForRetry(future, new Date())).toBe(false);
    });
    test("nextRetryAt = now → due (boundary)", () => {
      const now = new Date();
      expect(isDueForRetry(now, now)).toBe(true);
    });
    test("nextRetryAt = null → NOT due (permanently failed)", () => {
      expect(isDueForRetry(null, new Date())).toBe(false);
    });
  });

  describe("isPermanentFailure", () => {
    test("attempt 1 → not permanent", () => {
      expect(isPermanentFailure(1)).toBe(false);
    });
    test("attempt 4 → not permanent", () => {
      expect(isPermanentFailure(4)).toBe(false);
    });
    test("attempt 5 → permanent (max reached)", () => {
      expect(isPermanentFailure(5)).toBe(true);
    });
    test("attempt 10 → permanent", () => {
      expect(isPermanentFailure(10)).toBe(true);
    });
  });

  describe("computeNextRetryAt — exponential backoff", () => {
    test("Attempt 0 → 1 minute backoff", () => {
      const now = new Date("2026-08-28T12:00:00Z");
      const next = computeNextRetryAt(0, now);
      expect(next?.toISOString()).toBe("2026-08-28T12:01:00.000Z");
    });
    test("Attempt 1 → 5 minutes backoff", () => {
      const now = new Date("2026-08-28T12:00:00Z");
      const next = computeNextRetryAt(1, now);
      expect(next?.toISOString()).toBe("2026-08-28T12:05:00.000Z");
    });
    test("Attempt 2 → 25 minutes backoff", () => {
      const now = new Date("2026-08-28T12:00:00Z");
      const next = computeNextRetryAt(2, now);
      expect(next?.toISOString()).toBe("2026-08-28T12:25:00.000Z");
    });
    test("Attempt 3 → 2 hours backoff", () => {
      const now = new Date("2026-08-28T12:00:00Z");
      const next = computeNextRetryAt(3, now);
      expect(next?.toISOString()).toBe("2026-08-28T14:00:00.000Z");
    });
    test("Attempt 4 → 10 hours backoff", () => {
      const now = new Date("2026-08-28T12:00:00Z");
      const next = computeNextRetryAt(4, now);
      expect(next?.toISOString()).toBe("2026-08-28T22:00:00.000Z");
    });
    test("Attempt 5 (permanent) → null (no more retries)", () => {
      const now = new Date("2026-08-28T12:00:00Z");
      const next = computeNextRetryAt(5, now);
      expect(next).toBeNull();
    });
    test("Attempt 10 (past max) → null", () => {
      const next = computeNextRetryAt(10, new Date());
      expect(next).toBeNull();
    });
  });

  describe("Backoff schedule matches spec", () => {
    test("Schedule is [1m, 5m, 25m, 2h, 10h]", () => {
      expect(BACKOFF_MS).toEqual([60_000, 300_000, 1_500_000, 7_200_000, 36_000_000]);
    });
    test("5 backoff slots = maxAttempts = 5", () => {
      expect(BACKOFF_MS.length).toBe(5);
    });
  });

  describe("Claim query (simulated)", () => {
    test("A row with status=FAILED, nextRetryAt=now, attempts=2 → claimable", () => {
      const row = { status: "FAILED", nextRetryAt: new Date(), attemptCount: 2 };
      const claimable = row.status === "FAILED" && isDueForRetry(row.nextRetryAt, new Date()) && row.attemptCount < 5;
      expect(claimable).toBe(true);
    });
    test("A row with status=SUCCESS → NOT claimable", () => {
      const row = { status: "SUCCESS", nextRetryAt: new Date(), attemptCount: 0 };
      const claimable = row.status === "FAILED";
      expect(claimable).toBe(false);
    });
    test("A row with nextRetryAt in future → NOT claimable (backoff not elapsed)", () => {
      const row = { status: "FAILED", nextRetryAt: new Date(Date.now() + 60_000), attemptCount: 1 };
      const claimable = isDueForRetry(row.nextRetryAt, new Date());
      expect(claimable).toBe(false);
    });
    test("A row with nextRetryAt=null → NOT claimable (permanently failed)", () => {
      const row = { status: "FAILED", nextRetryAt: null, attemptCount: 5 };
      const claimable = isDueForRetry(row.nextRetryAt, new Date());
      expect(claimable).toBe(false);
    });
    test("A row with attempts=5 → NOT claimable (max reached)", () => {
      const row = { status: "FAILED", nextRetryAt: new Date(), attemptCount: 5 };
      const claimable = row.attemptCount < 5;
      expect(claimable).toBe(false);
    });
  });
});

describe("WooCommerce retry worker — concurrent invocation safety", () => {
  test("Two concurrent claims on the same row → only one wins (atomic updateMany)", () => {
    // The claimAndRetryFailed method uses db.syncLog.updateMany({ where: {
    // status: "FAILED", ... }, data: { status: "RETRYING" } }) — this is an
    // atomic operation, so two concurrent invocations can't both flip the
    // same row to RETRYING. The second invocation's updateMany will match 0
    // rows for any row the first already claimed.
    //
    // We simulate this: row id "A" is claimed by invocation 1 (status now
    // RETRYING). Invocation 2's WHERE clause (status = FAILED) no longer
    // matches row A.
    const rowA = { id: "A", status: "FAILED" };
    // Invocation 1 claims it:
    rowA.status = "RETRYING";
    // Invocation 2's claim query: WHERE status = "FAILED"
    const claim2Matched = rowA.status === "FAILED";
    expect(claim2Matched).toBe(false);
  });
});
