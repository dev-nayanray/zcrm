// Shared webhook-signing helpers for the Z-CRM test suite.
//
// The CRM's webhook receivers verify HMAC-SHA256 signatures against
// configured secrets. To keep the tests meaningful (they exercise the real
// security boundary), they sign their payloads with the same secrets the
// seed script populates in the dev database.
//
// These secrets are DEV-ONLY and ship in the seed file. They are NOT
// production secrets — operators must replace them with real App Secrets
// when configuring real Meta/WhatsApp connections.

import { createHmac } from "crypto";

// Must match the values in prisma/seed.ts.
export const META_APP_SECRET = "zcrm_meta_dev_app_secret_at_least_32_chars_padding";
export const WHATSAPP_APP_SECRET = "zcrm_wa_dev_app_secret_at_least_32_chars_padding";
export const TELEGRAM_WEBHOOK_SECRET = "zcrm_tg_webhook_secret";
export const WOOCOMMERCE_WEBHOOK_SECRET = "zcrm_woo_dev_webhook_secret_at_least_32_chars";

// Compute the X-Hub-Signature-256 header value (sha256=<hex>) used by Meta
// and WhatsApp webhooks.
export function hubSignature(secret: string, body: string): string {
  const hmac = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${hmac}`;
}

// Compute the X-WC-Webhook-Signature header value (base64 HMAC-SHA256) used
// by WooCommerce webhooks.
export function wooSignature(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64");
}

// Send a signed Meta webhook POST.
export async function postMetaWebhook(payload: unknown): Promise<Response> {
  const body = JSON.stringify(payload);
  return fetch("http://localhost:3000/api/v1/integrations/meta/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": hubSignature(META_APP_SECRET, body) },
    body,
  });
}

// Send a signed WhatsApp webhook POST.
export async function postWhatsAppWebhook(payload: unknown): Promise<Response> {
  const body = JSON.stringify(payload);
  return fetch("http://localhost:3000/api/v1/integrations/whatsapp/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": hubSignature(WHATSAPP_APP_SECRET, body) },
    body,
  });
}

// Send a signed Telegram webhook POST.
export async function postTelegramWebhook(payload: unknown): Promise<Response> {
  return fetch("http://localhost:3000/api/v1/integrations/telegram/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": TELEGRAM_WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  });
}
