import { NextRequest, NextResponse } from "next/server";
import { TelegramSessionStore } from "@/lib/services/telegram-session";
import { AuditService } from "@/lib/services/audit";

// Vercel Cron route — invoked every 15 minutes by Vercel's cron scheduler
// (config in vercel.json). Purges expired Telegram multi-step order draft
// sessions from the in-memory store.
//
// SECURITY: same pattern as /api/cron/woocommerce-retry — verifies the
// CRON_SECRET bearer token. Refuses to run if CRON_SECRET is not set.
//
// IDEMPOTENT: purgeExpired() is safe to call multiple times — it only
// deletes sessions whose updatedAt is older than the 10-minute TTL.
// Two concurrent invocations can't double-purge (delete is idempotent).

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(_request: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET not configured." },
      { status: 503 },
    );
  }

  const authHeader = _request.headers.get("authorization") || "";
  const querySecret = _request.nextUrl.searchParams.get("secret");
  const providedSecret = authHeader.replace(/^Bearer\s+/i, "") || querySecret;

  if (providedSecret !== CRON_SECRET) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const purged = TelegramSessionStore.purgeExpired();
    const remaining = TelegramSessionStore.activeCount();

    // Only audit if there was actual work (avoid spamming the audit log).
    if (purged > 0) {
      await AuditService.log({
        userId: null,
        action: "TELEGRAM_SESSION_CLEANUP",
        entity: "System",
        entityId: "cron",
        changes: { purged, remaining },
        source: "SYSTEM",
      });
    }

    return NextResponse.json({
      success: true,
      purged,
      remaining,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/session-cleanup] failed:", e);
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
