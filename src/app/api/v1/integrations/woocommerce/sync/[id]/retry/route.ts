import { NextRequest } from "next/server";
import { ok, serverError, notFound } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { WooCommerceService } from "@/lib/services/woocommerce";

// POST /api/v1/integrations/woocommerce/sync/[id]/retry
//
// Retry a previously-failed SyncLog row by re-running its operation. Only
// outbound push operations (push / push_stock / push_status) can be retried
// here — inbound sync retries should go through the /webhook-events/[id]/retry
// endpoint which re-runs the original webhook payload.
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("integrations:sync");
    if (err) return err;
    const { id } = await ctx.params;
    try {
      const result = await WooCommerceService.retrySyncLog(id);
      return ok(result);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("not found")) return notFound(msg);
      return serverError(msg);
    }
  } catch (e) {
    return serverError((e as Error).message);
  }
}
