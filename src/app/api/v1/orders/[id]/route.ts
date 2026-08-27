import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, validationError, notFound, badRequest, conflict } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { updateOrderStatusSchema } from "@/lib/validation";
import { OrderService } from "@/lib/services/order";
import { InventoryService } from "@/lib/services/inventory";
import { AuditService } from "@/lib/services/audit";
import { toDecimal } from "@/lib/decimal";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("orders:read");
    if (err) return err;
    const { id } = await ctx.params;
    const order = await db.order.findUnique({
      where: { id },
      include: {
        customer: true,
        channel: true,
        items: { include: { product: { select: { id: true, name: true, sku: true, sellingPrice: true } } } },
        payments: { include: { creator: { select: { id: true, name: true } } } },
        refunds: true,
        returns: { include: { items: { include: { product: { select: { name: true, sku: true } } } } } },
        statusHistory: { orderBy: { createdAt: "asc" } },
        creator: { select: { id: true, name: true } },
      },
    });
    if (!order) return notFound("Order not found");

    // Compute profit from historical snapshots
    let cogs = new (await import("@prisma/client")).Prisma.Decimal(0);
    for (const it of order.items) {
      cogs = cogs.add(toDecimal(it.unitCost).times(toDecimal(it.quantity)));
    }
    const revenue = toDecimal(order.total);
    const profit = revenue.minus(cogs).minus(toDecimal(order.shippingCost)).minus(toDecimal(order.otherCost));

    return ok({
      ...order,
      subtotal: order.subtotal.toFixed(2),
      discount: order.discount.toFixed(2),
      shippingCost: order.shippingCost.toFixed(2),
      otherCost: order.otherCost.toFixed(2),
      total: order.total.toFixed(2),
      paidAmount: order.paidAmount.toFixed(2),
      outstanding: toDecimal(order.total).minus(toDecimal(order.paidAmount)).lt(0) ? "0.00" : toDecimal(order.total).minus(toDecimal(order.paidAmount)).toFixed(2),
      cogs: cogs.toFixed(2),
      profit: profit.toFixed(2),
      items: order.items.map((i) => ({
        ...i,
        quantity: i.quantity.toFixed(3),
        unitPrice: i.unitPrice.toFixed(2),
        unitCost: i.unitCost.toFixed(2),
        discount: i.discount.toFixed(2),
        total: i.total.toFixed(2),
      })),
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("orders:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody(request);
    const parsed = updateOrderStatusSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    try {
      const updated = await OrderService.updateStatus(id, parsed.data.status, parsed.data.note);
      return ok(updated);
    } catch (e) {
      return badRequest((e as Error).message);
    }
  } catch (e) {
    return serverError((e as Error).message);
  }
}

// DELETE — hard-delete an order. We only allow this when the order is
// PENDING and unpaid; any other state means stock has been moved (sold,
// reserved, or returned) and the order must be cancelled instead.
//
// CRITICAL FIX: the previous implementation called `db.order.delete()`
// directly, bypassing OrderService. For an order created with
// `reserveStock: true`, this LEAKED the reserved stock forever
// (Inventory.reservedQuantity stayed inflated; the StockMovement rows
// referenced a deleted order). Now we release the reservation (or emit
// RETURN movements for default orders) inside a transaction, write an
// audit log, then delete.
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("orders:delete");
    if (err) return err;
    const { id } = await ctx.params;

    // Atomically: re-check conditions, release stock, audit, delete.
    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) return { kind: "not_found" as const };
      // Only allow delete if PENDING and unpaid. Re-check inside the tx
      // to avoid the race where a payment arrives between the outer check
      // and the delete (would violate Payment.orderId onDelete:Restrict).
      if (order.status !== "PENDING" || toDecimal(order.paidAmount).gt(0)) {
        return { kind: "conflict" as const };
      }
      // Release the stock that was tied up by this order:
      //  - If reserveStock=true, release the reservation per item.
      //  - If reserveStock=false (default), emit RETURN movements per item
      //    to put the stock back. (PENDING default orders deducted stock
      //    as SALE at creation time.)
      for (const it of order.items) {
        if (order.stockReserved) {
          await InventoryService.releaseInTx(tx, {
            productId: it.productId,
            quantity: it.quantity,
            reason: `Order ${order.orderNumber} deleted — release reservation`,
            referenceId: order.id,
          });
        } else {
          await InventoryService.applyMovementInTx(tx, {
            productId: it.productId,
            type: "RETURN",
            quantityChange: it.quantity,
            reason: `Order ${order.orderNumber} deleted — return to stock`,
            referenceType: "Order",
            referenceId: order.id,
          });
        }
      }
      await tx.order.delete({ where: { id } });
      await AuditService.log(
        {
          userId: user.id,
          action: "ORDER_DELETE",
          entity: "Order",
          entityId: id,
          changes: { orderNumber: order.orderNumber, stockReserved: order.stockReserved },
        },
        tx,
      );
      return { kind: "ok" as const };
    });

    if (result.kind === "not_found") return notFound("Order not found");
    if (result.kind === "conflict") return conflict("Only unpaid pending orders can be deleted");
    return ok({ success: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
