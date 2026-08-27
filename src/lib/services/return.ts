import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal, cmpMoney } from "@/lib/decimal";
import { InventoryService } from "./inventory";
import { getCurrentUser } from "@/lib/auth";
import { AuditService } from "./audit";

// ReturnService — handles returns & exchanges.
// GOOD return: increases sellable stock (RETURN movement).
// DAMAGED return: increases damaged bucket only — the customer kept the
//   sellable stock out of the warehouse, so sellable must NOT change
//   (DAMAGED_RETURN movement). The previous implementation used DAMAGE
//   which subtracted from sellable, making DAMAGED returns impossible for
//   low-stock products and silently corrupting the sellable count.
//
// FIX: refundAmount is now validated ≤ order.paidAmount (was unvalidated —
// could record a refund larger than what was ever paid). paymentStatus on
// full refund is now "REFUNDED" (matches RefundService). Order is marked
// RETURNED only when the cumulative returned quantity across ALL returns
// matches the ordered quantity for ALL items (was: matched on item count,
// so a 1-of-each-line-item return incorrectly marked a multi-unit order as
// fully RETURNED). Returns are now rejected when the order is in PENDING
// or CANCELLED status (items were never dispatched to the customer).
export const ReturnService = {
  async create(input: {
    orderId: string;
    type?: string;
    reason?: string;
    refundAmount?: Prisma.Decimal | number | string;
    items: { productId: string; quantity: Prisma.Decimal | number | string; condition?: string }[];
    refund?: { method: string; transactionReference?: string; notes?: string };
    createdBy?: string;
  }) {
    return db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const createdBy = input.createdBy ?? user?.id;

      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: { items: true, payments: true, returns: { include: { items: true } } },
      });
      if (!order) throw new Error("Order not found");

      // Reject returns for orders that haven't been dispatched yet —
      // items are still in the warehouse (or were never sent).
      const allowedStatuses = ["SHIPPED", "DELIVERED", "RETURNED"];
      if (!allowedStatuses.includes(order.status)) {
        throw new Error(`Cannot return items for an order with status ${order.status}. Order must be SHIPPED, DELIVERED, or already RETURNED.`);
      }

      const refundAmount = toDecimal(input.refundAmount ?? 0);

      // Validate refundAmount ≤ paidAmount (cannot refund more than was paid).
      if (refundAmount.gt(order.paidAmount)) {
        throw new Error(`Refund amount (${refundAmount.toFixed(2)}) exceeds paid amount (${order.paidAmount.toFixed(2)})`);
      }

      // Validate that returned quantities do not exceed ordered quantities
      // AND don't exceed the cumulative-not-yet-returned quantity across
      // all prior returns on this order.
      for (const item of input.items) {
        const qty = toDecimal(item.quantity);
        if (qty.lte(0)) throw new Error("Return quantity must be positive");
        const oi = order.items.find((i) => i.productId === item.productId);
        if (!oi) throw new Error("Product not part of this order");
        // Sum already-returned qty for this product across prior returns.
        const alreadyReturned = order.returns
          .flatMap((r) => r.items.filter((ri) => ri.productId === item.productId))
          .reduce((s, ri) => s.plus(toDecimal(ri.quantity)), new Prisma.Decimal(0));
        if (qty.plus(alreadyReturned).gt(oi.quantity)) {
          throw new Error(`Cumulative return quantity exceeds ordered quantity for product ${oi.sku} (already returned: ${alreadyReturned.toFixed(0)}, ordered: ${oi.quantity.toFixed(0)})`);
        }
      }

      const ret = await tx.return.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          status: "COMPLETED",
          type: input.type ?? "RETURN",
          reason: input.reason,
          refundAmount,
          createdBy,
          items: {
            create: input.items.map((it) => ({
              productId: it.productId,
              quantity: toDecimal(it.quantity),
              condition: it.condition ?? "GOOD",
            })),
          },
        },
        include: { items: true },
      });

      // Apply stock movement per returned item (within the same transaction)
      for (const it of input.items) {
        const condition = it.condition ?? "GOOD";
        if (condition === "GOOD") {
          // increase sellable stock
          await InventoryService.applyMovementInTx(tx, {
            productId: it.productId,
            type: "RETURN",
            quantityChange: toDecimal(it.quantity),
            referenceType: "RETURN",
            referenceId: ret.id,
            reason: `Return for ${order.orderNumber}`,
            createdBy,
          });
        } else {
          // DAMAGED customer return — increase damaged bucket only.
          // Sellable is NOT touched (the customer kept the sellable unit
          // out of the warehouse). The DAMAGE movement (sellable → damaged)
          // is reserved for internal stock conversions.
          await InventoryService.applyMovementInTx(tx, {
            productId: it.productId,
            type: "DAMAGED_RETURN",
            quantityChange: toDecimal(it.quantity),
            referenceType: "RETURN",
            referenceId: ret.id,
            reason: `Damaged return for ${order.orderNumber}`,
            createdBy,
          });
        }
      }

      // Optional refund linked to the return
      if (refundAmount.gt(0) && input.refund) {
        const payment = order.payments[0];
        await tx.refund.create({
          data: {
            orderId: order.id,
            paymentId: payment?.id,
            returnId: ret.id,
            amount: refundAmount,
            method: input.refund.method,
            transactionReference: input.refund.transactionReference,
            notes: input.refund.notes,
            createdBy,
          },
        });

        // Reduce order's paid amount & recompute status. Standardize on
        // "REFUNDED" when the full paid amount has been refunded (matches
        // RefundService — previously this branch set "UNPAID").
        const newPaid = toDecimal(order.paidAmount).minus(refundAmount);
        let paymentStatus: "PARTIAL" | "REFUNDED" = "PARTIAL";
        if (newPaid.lte(0)) paymentStatus = "REFUNDED";
        await tx.order.update({
          where: { id: order.id },
          data: { paidAmount: newPaid.lt(0) ? new Prisma.Decimal(0) : newPaid, paymentStatus },
        });
      }

      // Mark order as RETURNED only when cumulative returned quantity
      // matches ordered quantity for ALL items (was: matched on count —
      // a 1-of-each-line-item return incorrectly marked a multi-unit
      // order as fully RETURNED).
      const allReturned = order.items.every((oi) => {
        const alreadyReturned = order.returns
          .flatMap((r) => r.items.filter((ri) => ri.productId === oi.productId))
          .reduce((s, ri) => s.plus(toDecimal(ri.quantity)), new Prisma.Decimal(0));
        const thisReturn = toDecimal(input.items.find((it) => it.productId === oi.productId)?.quantity ?? 0);
        return alreadyReturned.plus(thisReturn).gte(oi.quantity);
      });
      if (allReturned) {
        await tx.order.update({ where: { id: order.id }, data: { status: "RETURNED" } });
      }

      await AuditService.log({
        userId: createdBy,
        action: "RETURN_CREATE",
        entity: "Return",
        entityId: ret.id,
        changes: { orderId: order.id, items: input.items.length, refund: refundAmount.toFixed(2) },
      }, tx);

      return tx.return.findUnique({
        where: { id: ret.id },
        include: { items: { include: { product: { select: { name: true, sku: true } } } }, order: true },
      });
    }, { timeout: 20000, maxWait: 10000 });
  },
};

export const RefundService = {
  async create(input: {
    orderId: string;
    amount: Prisma.Decimal | number | string;
    method?: string;
    paymentId?: string | null;
    returnId?: string | null;
    transactionReference?: string;
    notes?: string;
    createdBy?: string;
  }) {
    return db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const createdBy = input.createdBy ?? user?.id;
      const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { payments: true } });
      if (!order) throw new Error("Order not found");
      const amount = toDecimal(input.amount);
      if (amount.lte(0)) throw new Error("Refund amount must be positive");
      if (amount.gt(order.paidAmount)) throw new Error("Refund amount exceeds paid amount");

      const refund = await tx.refund.create({
        data: {
          orderId: order.id,
          paymentId: input.paymentId ?? order.payments[0]?.id ?? null,
          returnId: input.returnId ?? null,
          amount,
          method: input.method ?? "CASH",
          transactionReference: input.transactionReference,
          notes: input.notes,
          createdBy,
        },
      });

      const newPaid = toDecimal(order.paidAmount).minus(amount);
      let paymentStatus: "PARTIAL" | "REFUNDED" = "PARTIAL";
      if (newPaid.lte(0)) paymentStatus = "REFUNDED";
      await tx.order.update({
        where: { id: order.id },
        data: { paidAmount: newPaid.lt(0) ? new Prisma.Decimal(0) : newPaid, paymentStatus },
      });

      await AuditService.log({
        userId: createdBy,
        action: "REFUND_CREATE",
        entity: "Refund",
        entityId: refund.id,
        changes: { orderId: order.id, amount: amount.toFixed(2) },
      }, tx);

      return refund;
    }, { timeout: 20000, maxWait: 10000 });
  },
};

// Keep cmpMoney referenced for downstream callers that may import it.
void cmpMoney;
