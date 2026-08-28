import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { WooCommerceService } from "@/lib/services/woocommerce";

// POST ?entity=products|orders|categories|variations&parentId=N — trigger a bulk sync
export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("integrations:sync");
    if (err) return err;
    const entity = request.nextUrl.searchParams.get("entity");
    if (entity === "products") {
      const result = await WooCommerceService.bulkSyncProducts();
      return ok(result);
    }
    if (entity === "orders") {
      const result = await WooCommerceService.bulkSyncOrders();
      return ok(result);
    }
    if (entity === "categories") {
      const result = await WooCommerceService.bulkSyncCategories();
      return ok(result);
    }
    if (entity === "variations") {
      const parentIdStr = request.nextUrl.searchParams.get("parentId");
      if (!parentIdStr) return badRequest("?entity=variations requires ?parentId=N (the WooCommerce parent product id)");
      const parentId = Number(parentIdStr);
      if (!Number.isFinite(parentId)) return badRequest("parentId must be a number");
      const result = await WooCommerceService.bulkSyncVariations(parentId);
      return ok(result);
    }
    return badRequest("Use ?entity=products | orders | categories | variations");
  } catch (e) {
    return serverError((e as Error).message);
  }
}

// Sync logs list
export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("integrations:read");
    if (err) return err;
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "20", 10) || 20));
    const entityFilter = request.nextUrl.searchParams.get("entity") || undefined;
    const statusFilter = request.nextUrl.searchParams.get("status") || undefined;
    const { items, total } = await WooCommerceService.listSyncLogs({ page, limit, entity: entityFilter, status: statusFilter });
    return ok({ items, total, page, limit });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
