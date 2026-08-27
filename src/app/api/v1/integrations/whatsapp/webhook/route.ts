import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { WhatsAppService } from "@/lib/services/whatsapp";

// WhatsApp webhook: GET for verification, POST for events.
// GET uses the webhookVerifyToken of ANY configured WhatsApp connection.
// POST requires HMAC-SHA256 signature of the raw body using the App Secret
// of the matched connection. We never accept an unsigned payload.

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function hexFromBuf(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");
  const conns = await db.whatsAppConnection.findMany();
  for (const c of conns) {
    if (WhatsAppService.verifyWebhook(mode, token, challenge, c.webhookVerifyToken)) {
      return new NextResponse(challenge ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const sigHeader = request.headers.get("x-hub-signature-256") || "";
    const sigMatch = sigHeader.match(/^sha256=([a-f0-9]+)$/i);
    if (!sigMatch) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const signature = sigMatch[1].toLowerCase();

    // Try every configured connection's app secret until one verifies.
    const conns = await db.whatsAppConnection.findMany();
    let matchedConnId: string | undefined;
    let verified = false;
    for (const c of conns) {
      if (!c.appSecret) continue;
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(c.appSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
      const expected = hexFromBuf(sigBuf);
      if (constantTimeEqual(expected, signature)) {
        verified = true;
        matchedConnId = c.id;
        break;
      }
    }
    if (!verified) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const results = await WhatsAppService.processWebhook(payload, matchedConnId);
    return NextResponse.json({ success: true, data: { received: true, results } });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: (e as Error).message } },
      { status: 500 },
    );
  }
}
