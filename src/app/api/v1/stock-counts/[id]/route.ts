import { NextRequest } from "next/server";
import { ok, serverError, notFound, badRequest, forbidden } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { StockReconciliationService } from "@/lib/services/stock-reconciliation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("stock_counts:read");
    if (err) return err;
    const { id } = await ctx.params;
    const sc = await StockReconciliationService.get(id);
    if (!sc) return notFound("Stock count not found");
    return ok({ ...sc, items: sc.items.map((i: any) => ({ ...i, systemQuantity: i.systemQuantity.toFixed(3), countedQuantity: i.countedQuantity.toFixed(3), difference: i.difference.toFixed(3) })) });
  } catch (e) { return serverError((e as Error).message); }
}

// POST — branch the permission check by action so segregation-of-duties
// is enforced: an INVENTORY user (who has inventory:adjust but NOT
// stock_counts:approve) can prepare a count but cannot approve their own
// count and apply ADJUSTMENT movements unilaterally. Only MANAGER+ can
// approve/reject (stock_counts:approve).
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await readJsonBody<{ action: "submit" | "addItem" | "approve" | "reject"; productId?: string; countedQuantity?: number | string }>(request);
    if (!body?.action) return badRequest("action required");

    // Branch by action — different permissions for different steps of the
    // reconciliation workflow.
    const needsApprovePerm = body.action === "approve" || body.action === "reject";
    const [, err] = await requirePermission(needsApprovePerm ? "stock_counts:approve" : "inventory:adjust");
    if (err) return err;

    try {
      if (body.action === "submit") return ok(await StockReconciliationService.submit(id));
      if (body.action === "approve") return ok(await StockReconciliationService.approve(id));
      if (body.action === "reject") return ok(await StockReconciliationService.reject(id));
      if (body.action === "addItem" && body.productId) return ok(await StockReconciliationService.addItem(id, body.productId, body.countedQuantity ?? 0));
      return badRequest("Unknown action");
    } catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}

void forbidden;
