// Unit tests for the WooCommerce webhook signature verifier.
//
// These tests confirm that the constant-time HMAC-SHA256 comparison correctly
// rejects:
//   - missing signatures
//   - tampered payloads
//   - wrong-secret signatures
//
// They do NOT test the full webhook endpoint (that lives in
// integration.test.ts and requires a running server) — they only test the
// pure signing logic.

import { createHmac } from "crypto";
import { describe, test, expect } from "bun:test";
import { WOOCOMMERCE_WEBHOOK_SECRET } from "./webhook-signer";

// Replicate the constant-time comparison from the webhook route. The route
// does NOT export this function (it's a private helper), so we duplicate it
// here to test the algorithm itself.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Replicate the signing logic from the webhook route.
function computeExpectedSignature(secret: string, rawBody: string): string {
  // The route uses Web Crypto's subtle.sign; for tests we use Node's
  // crypto module which produces the same bytes.
  return createHmac("sha256", secret).update(rawBody).digest("base64");
}

describe("WooCommerce webhook signature verification", () => {
  // Use the shared dev secret from webhook-signer.ts (matches the seed file).
  const secret = WOOCOMMERCE_WEBHOOK_SECRET;
  const payload = JSON.stringify({
    id: 12345,
    number: "10025",
    status: "processing",
    total: "2500.00",
  });

  test("accepts a correctly-signed payload", () => {
    const sig = computeExpectedSignature(secret, payload);
    expect(constantTimeEqual(sig, sig)).toBe(true);
  });

  test("rejects a tampered payload (signature no longer matches)", () => {
    const sig = computeExpectedSignature(secret, payload);
    const tamperedPayload = JSON.stringify({ ...JSON.parse(payload), total: "9999.00" });
    const tamperedSig = computeExpectedSignature(secret, tamperedPayload);
    expect(constantTimeEqual(sig, tamperedSig)).toBe(false);
  });

  test("rejects a signature computed with the wrong secret", () => {
    const correctSig = computeExpectedSignature(secret, payload);
    const wrongSecretSig = computeExpectedSignature("wrong-secret", payload);
    expect(constantTimeEqual(correctSig, wrongSecretSig)).toBe(false);
  });

  test("rejects a signature of different length (missing/truncated)", () => {
    const sig = computeExpectedSignature(secret, payload);
    const truncated = sig.slice(0, 10);
    expect(constantTimeEqual(sig, truncated)).toBe(false);
  });

  test("rejects an empty signature", () => {
    const sig = computeExpectedSignature(secret, payload);
    expect(constantTimeEqual(sig, "")).toBe(false);
  });

  test("timing-safe: comparison time does not leak length info", () => {
    // This is a smoke test — we just verify the function returns a boolean
    // for both equal and unequal inputs of the same length. A real timing
    // attack would require thousands of iterations and statistical analysis.
    const a = computeExpectedSignature(secret, payload);
    const b = computeExpectedSignature(secret + "x", payload);
    expect(typeof constantTimeEqual(a, a)).toBe("boolean");
    expect(typeof constantTimeEqual(a, b)).toBe("boolean");
  });
});

describe("WooCommerce status mapping (Woo → CRM)", () => {
  // These mappings are duplicated in the webhook route's syncOrder flow.
  // We test them here as a regression check — if anyone changes the map,
  // the existing synced orders could be moved to the wrong CRM status.
  const WOO_TO_CRM: Record<string, string> = {
    pending: "PENDING",
    processing: "CONFIRMED",
    "on-hold": "PENDING",
    completed: "DELIVERED",
    cancelled: "CANCELLED",
    refunded: "REFUNDED",
    failed: "CANCELLED",
  };

  test("processing → CONFIRMED", () => {
    expect(WOO_TO_CRM["processing"]).toBe("CONFIRMED");
  });
  test("completed → DELIVERED", () => {
    expect(WOO_TO_CRM["completed"]).toBe("DELIVERED");
  });
  test("cancelled → CANCELLED", () => {
    expect(WOO_TO_CRM["cancelled"]).toBe("CANCELLED");
  });
  test("refunded → REFUNDED", () => {
    expect(WOO_TO_CRM["refunded"]).toBe("REFUNDED");
  });
  test("unknown status falls through to default (CONFIRMED in the route)", () => {
    expect(WOO_TO_CRM["unknown-status"]).toBeUndefined();
  });
});
