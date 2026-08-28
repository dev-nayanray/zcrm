import { NextRequest } from "next/server";
import { ok, serverError, badRequest, forbidden } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { db } from "@/lib/db";
import { OrderService } from "@/lib/services/order";
import { validateOrderStatusTransition } from "@/lib/services/order";
import { AuditService } from "@/lib/services/audit";
import { toast } from "sonner";

// POST /api/v1/orders/bulk-status
// Body: { orderIds: string[], status: string, note?: string }
//
// Batch-update the status of multiple orders. Each order's transition is
// validated individually via validateOrderStatusTransition — invalid
// transitions are reported as failures, not silently applied.
//
// RBAC: requires orders:update permission.
// Safety: does NOT allow bulk payments, refunds, expenses, or deletions —
// only status transitions, which are safe and reversible (unless terminal).

type BulkStatusResult = {
  orderId: string;
  orderNumber: string;
  success: boolean;
  error?: string;
};

export async function POST(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("orders:update");
    if (err) return err;

    const body = await readJsonBody<{ orderIds: string[]; status: string; note?: string }>(request);
    if (!body?.orderIds || !Array.isArray(body.orderIds) || body.orderIds.length === 0) {
      return badRequest("orderIds must be a non-empty array");
    }
    if (!body.status || typeof body.status !== "string") {
      return badRequest("status is required");
    }
    if (body.orderIds.length > 100) {
      return badRequest("Maximum 100 orders per bulk update");
    }

    const targetStatus = body.status.toUpperCase();
    const results: BulkStatusResult[] = [];
    let successCount = 0;
    let failCount = 0;

    // Process each order individually — we don't use a single transaction
    // because a single failure shouldn't roll back successful updates.
    // Each order gets its own OrderService.updateStatus call (which opens
    // its own transaction, enforces the state machine, updates stock,
    // fires automation, and audits).
    for (const orderId of body.orderIds) {
      try {
        // Fetch the order first to check current status
        const order = await db.order.findUnique({
          where: { id: orderId },
          select: { id: true, orderNumber: true, status: true },
        });
        if (!order) {
          results.push({ orderId, orderNumber: "—", success: false, error: "Order not found" });
          failCount++;
          continue;
        }

        // Validate the transition BEFORE calling updateStatus (which would
        // throw and we'd catch it anyway, but this gives us a cleaner error
        // message without the overhead of a failed transaction).
        try {
          validateOrderStatusTransition(order.status, targetStatus);
        } catch (e) {
          results.push({ orderId, orderNumber: order.orderNumber, success: false, error: (e as Error).message });
          failCount++;
          continue;
        }

        // Apply the transition
        await OrderService.updateStatus(orderId, targetStatus, body.note || `Bulk status update by ${user.name}`);
        results.push({ orderId, orderNumber: order.orderNumber, success: true });
        successCount++;
      } catch (e) {
        results.push({ orderId, orderNumber: "—", success: false, error: (e as Error).message });
        failCount++;
      }
    }

    await AuditService.log({
      userId: user.id,
      action: "ORDER_BULK_STATUS_UPDATE",
      entity: "Order",
      entityId: "bulk",
      changes: { targetStatus, successCount, failCount, orderCount: body.orderIds.length },
      source: "WEB",
    });

    return ok({ successCount, failCount, results });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

void forbidden; void toast;
