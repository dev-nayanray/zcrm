import { NextRequest, NextResponse } from "next/server";
import { TelegramCommandService } from "@/lib/services/telegram-command";
import { db } from "@/lib/db";

// Telegram webhook — handles:
// 1. GET requests (Telegram sometimes does health checks, browsers access
//    directly).
// 2. POST requests (actual Telegram Updates). Telegram sends a custom
//    header `X-Telegram-Bot-Api-Secret-Token` whose value matches the secret
//    we set when calling setWebhook. We REQUIRE this header to match — an
//    empty or mismatched secret token returns 401, preventing anyone on
//    the internet from POSTing forged Telegram updates that would execute
//    20+ CRM commands via TelegramCommandService.
// 3. Empty body or non-JSON returns 200 instead of 400 so Telegram doesn't
//    retry.
//
// Idempotent by update_id (dedup via TelegramWebhookEvent unique constraint).

export async function GET(_request: NextRequest) {
  return new NextResponse("Z-CRM Telegram Webhook — Active", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: verify the X-Telegram-Bot-Api-Secret-Token header. Telegram
    // sends this when we configured it via setWebhook with `secret_token`.
    // We refuse to process the update if no bot is configured OR if the
    // configured webhookSecret is empty OR if the header doesn't match.
    const cfg = await db.telegramBot.findFirst();
    if (!cfg || !cfg.webhookSecret) {
      // No bot configured or no secret set — refuse to process any update.
      // Returning 200 (not 401) so Telegram doesn't retry forever, but
      // logging the rejection.
      console.warn("[Telegram Webhook] Rejected update: no bot or no webhookSecret configured");
      return NextResponse.json(
        { ok: true, result: { ok: false, action: "no_secret_configured" } },
        { status: 200 },
      );
    }
    const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (!incomingSecret || incomingSecret !== cfg.webhookSecret) {
      console.warn("[Telegram Webhook] Rejected update: secret token mismatch");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Parse the body — handle empty body gracefully so Telegram doesn't
    // keep retrying on transient empty deliveries.
    const text = await request.text();
    if (!text || text.trim() === "") {
      return NextResponse.json({ ok: true, result: { ok: true, action: "empty_body" } });
    }

    let update: any;
    try {
      update = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: true, result: { ok: true, action: "non_json" } });
    }

    if (!update || update.update_id === undefined) {
      return NextResponse.json({ ok: true, result: { ok: true, action: "no_update_id" } });
    }

    // Process the update (idempotent by update_id)
    const result = await TelegramCommandService.processUpdate(update);

    // Update lastWebhookAt
    try {
      await db.telegramBot.update({
        where: { id: cfg.id },
        data: { lastWebhookAt: new Date() },
      });
    } catch {
      // ignore DB update errors
    }

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    // Return 200 even on errors so Telegram doesn't retry endlessly
    console.error("[Telegram Webhook] Error:", e);
    return NextResponse.json(
      { ok: true, result: { ok: false, error: (e as Error).message } },
      { status: 200 },
    );
  }
}

// Handle OPTIONS for CORS preflight (proxy/firewall checks)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Telegram-Bot-Api-Secret-Token",
    },
  });
}
