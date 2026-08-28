import { NextRequest, NextResponse } from "next/server";
import { WooCommerceService } from "@/lib/services/woocommerce";
import { AuditService } from "@/lib/services/audit";

// Vercel Cron route — invoked every 5 minutes by Vercel's cron scheduler
// (config in vercel.json). Processes failed WooCommerce SyncLog rows whose
// nextRetryAt has elapsed.
//
// SECURITY:
//   Vercel sends an `Authorization: Bearer <CRON_SECRET>` header on every
//   cron invocation. We verify it against process.env.CRON_SECRET.
//   If CRON_SECRET is not set, we refuse to run (so the route can't be
//   triggered by an unauthenticated external request in a misconfigured
//   deployment).
//
// IDEMPOTENCY:
//   claimAndRetryFailed() uses an atomic updateMany to claim rows — two
//   concurrent cron invocations won't double-process the same SyncLog row.
//   The retry itself (retrySyncLog) is idempotent: re-running a successful
//   push is a no-op on the Woo side (PUT is idempotent).
//
// RATE LIMITING:
//   Capped at 50 rows per invocation. With a 5-minute schedule, that's max
//   600 retries/hour — well within Woo's REST API rate limits.

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(_request: NextRequest) {
  // ── Auth check ──
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    // CRON_SECRET not configured — refuse to run. This prevents the route
    // from being a public endpoint anyone can hit.
    return NextResponse.json(
      { success: false, error: "CRON_SECRET not configured — set it in Vercel env vars to enable the retry worker." },
      { status: 503 },
    );
  }

  // Vercel cron sends the secret as a Bearer token. We also accept it as
  // a query param (?secret=) for manual testing.
  const authHeader = _request.headers.get("authorization") || "";
  const querySecret = _request.nextUrl.searchParams.get("secret");
  const providedSecret = authHeader.replace(/^Bearer\s+/i, "") || querySecret;

  if (providedSecret !== CRON_SECRET) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await WooCommerceService.claimAndRetryFailed({ limit: 50 });

    // Audit the run (only if there was actual work to do — avoids spamming
    // the audit log with empty runs every 5 minutes).
    if (result.claimed > 0) {
      await AuditService.log({
        userId: null,
        action: "WOOCOMMERCE_RETRY_WORKER_RUN",
        entity: "SyncLog",
        entityId: "cron",
        changes: result,
      });
    }

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/woocommerce-retry] failed:", e);
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
