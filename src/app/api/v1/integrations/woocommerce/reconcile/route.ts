import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { WooCommerceService } from "@/lib/services/woocommerce";

// GET /api/v1/integrations/woocommerce/reconcile?entity=products|orders
//
// Compares Z-CRM records against WooCommerce's current state and returns a
// report of differences. Does NOT modify any data — the admin decides what
// to resync based on the report.
//
// Result categories per entity:
//   MATCHED   — CRM record exists, Woo record exists, fields agree
//   CRM_ONLY  — CRM record exists, Woo has no matching record
//   WOO_ONLY  — Woo record exists, CRM has no matching record
//   DIFFERENT — both exist but key fields disagree (price, stock, status)
//   ERROR     — couldn't fetch from Woo (auth, network, etc.)
//
// The `details` array contains one entry per checked entity with the
// comparison result. For DIFFERENT entries, the `differences` array lists
// the specific field disagreements.

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("integrations:read");
    if (err) return err;

    const entity = request.nextUrl.searchParams.get("entity") || "products";
    const limitStr = request.nextUrl.searchParams.get("limit");
    const limit = limitStr ? Math.min(Number(limitStr), 5000) : undefined;

    if (entity === "products") {
      const result = await WooCommerceService.reconcileProducts({ limit });
      return ok(result);
    }
    if (entity === "orders") {
      const result = await WooCommerceService.reconcileOrders({ limit });
      return ok(result);
    }
    return badRequest("Use ?entity=products or ?entity=orders");
  } catch (e) {
    return serverError((e as Error).message);
  }
}
