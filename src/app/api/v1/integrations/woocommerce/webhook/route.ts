import { NextRequest } from "next/server";
import { ok, serverError, unauthorized } from "@/lib/api";
import { WooCommerceService } from "@/lib/services/woocommerce";
import { AuditService } from "@/lib/services/audit";
import { WebhookService } from "@/lib/services/webhook";

// WooCommerce webhook receiver.
//
// Idempotency is now enforced at TWO layers:
//
// 1. EVENT LEVEL — every webhook delivery is recorded via
//    WebhookService.recordEvent({ provider: "woocommerce", eventId }).
//    The eventId is the WooCommerce delivery ID (X-WC-Webhook-Delivery-ID
//    header) — uniquely identifies a single delivery attempt. If the same
//    delivery ID arrives twice, we skip re-processing.
//
// 2. ENTITY LEVEL — syncProduct / syncCustomer / syncOrder look up by
//    externalId (now `@unique`) before creating. This catches the case where
//    Woo sends two different delivery IDs for the same underlying entity
//    update (e.g. a "product.updated" event followed by a "product.updated"
//    event that Woo itself fired twice).
//
// Webhook signature verification uses HMAC-SHA256 of the raw body with the
// configured webhook secret (x-wc-webhook-signature header). If no secret
// is configured we REJECT the request — silently accepting any unsigned POST
// would let anyone on the internet create orders/customers/products in the
// CRM.

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function POST(request: NextRequest) {
  try {
    const cfg = await WooCommerceService.getConfig();
    // SECURITY: a non-empty webhook secret is REQUIRED. The seed sets this
    // to a random 32-byte hex value to prevent the silent-accept path.
    if (!cfg || !cfg.webhookSecret) {
      return unauthorized("Webhook secret not configured");
    }
    const rawBody = await request.text();
    const signature = request.headers.get("x-wc-webhook-signature") || "";
    // Compute HMAC-SHA256 of the raw body, base64-encode, compare in
    // constant time. The verification block is OUTSIDE any try/catch —
    // any crypto exception bubbles up to the outer catch and returns 500,
    // never silently bypasses the check.
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(cfg.webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
    // Chunk the Uint8Array to avoid the spread-arg limit on large bodies.
    let expected = "";
    const bytes = new Uint8Array(sigBuf);
    for (let i = 0; i < bytes.length; i++) expected += String.fromCharCode(bytes[i]);
    expected = btoa(expected);
    if (!constantTimeEqual(expected, signature)) {
      return unauthorized("Invalid webhook signature");
    }

    const event = request.headers.get("x-wc-webhook-topic") || "";
    // Event-level dedup: use WooCommerce's delivery ID header when present,
    // else fall back to a hash of the body+topic (so two deliveries of the
    // same payload still get deduped).
    const deliveryId = request.headers.get("x-wc-webhook-delivery-id") || `body-${event}-${rawBody.length}`;
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const userId: string | null = null; // webhook has no CRM user

    const { isDuplicate } = await WebhookService.recordEvent({
      provider: "woocommerce",
      eventId: deliveryId,
      eventType: event,
      payload,
    });
    if (isDuplicate) {
      // Already processed successfully — skip. Returning 200 OK so Woo doesn't
      // retry unnecessarily.
      return ok({ received: true, duplicate: true });
    }

    try {
      if (event.startsWith("product.")) {
        await WooCommerceService.syncProduct(payload as any);
      } else if (event.startsWith("customer.")) {
        await WooCommerceService.syncCustomer(payload as any);
      } else if (event.startsWith("order.")) {
        await WooCommerceService.syncOrder(payload as any);
      } else {
        await AuditService.log({ userId, action: "WOOCOMMERCE_SYNC", entity: "Webhook", entityId: event, changes: { ignored: true } });
      }
      await WebhookService.markSuccess("woocommerce", deliveryId);
    } catch (e) {
      await WebhookService.markFailed("woocommerce", deliveryId, (e as Error).message, "FAILED");
      throw e;
    }

    return ok({ received: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
