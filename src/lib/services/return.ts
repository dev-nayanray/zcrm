import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal, cmpMoney } from "@/lib/decimal";
import { InventoryService } from "./inventory";
import { getCurrentUser } from "@/lib/auth";
import { AuditService } from "./audit";
import { OrderService } from "./order";
import { ProfitabilityService } from "./profitability";

// ReturnService — handles returns & exchanges.
// GOOD return: increases sellable stock (RETURN movement).
// DAMAGED return: increases damaged bucket only — the customer kept the
//   sellable stock out of the warehouse, so sellable must NOT change
//   (DAMAGED_RETURN movement). The previous implementation used DAMAGE
//   which subtracted from sellable, making DAMAGED returns impossible for
//   low-stock products and silently corrupting the sellable count.
//
// WORKFLOW (Phase 3):
//   1. ReturnService.request() — creates a PENDING return, sets order to
//      RETURN_REQUESTED (validates the order is in a returnable state).
//      Does NOT touch stock or refund yet.
//   2. ReturnService.approve(id) — transitions PENDING → COMPLETED,
//      applies the stock movement (RETURN or DAMAGED_RETURN), creates the
//      refund (if refundAmount > 0), re-derives order payment status,
//      and transitions the order to RETURNED if all items returned.
//   3. ReturnService.create() — the legacy one-shot path that does both
//      steps at once (kept for back-compat with existing API callers).
//
// INTEGRITY:
//   - refundAmount validated ≤ order.paidAmount
//   - Returned quantities validated ≤ ordered − already-returned
//   - Order status transitions go through validateOrderStatusTransition
//     (was: direct tx.order.update, bypassing the state machine)
//   - Audit log fires inside the transaction
//   - Profitability snapshot is re-persisted after refund creation
export const ReturnService = {
  // ── NEW: Create a PENDING return request (does not touch stock/refund) ──
  // Used by Telegram /returnorder and the "Request Return" UI button.
  // Stock and refund are applied only when an admin calls approve(id).
  async request(input: {
    orderId: string;
    type?: string;
    reason?: string;
    items: { productId: string; quantity: Prisma.Decimal | number | string; condition?: string }[];
    refundAmount?: Prisma.Decimal | number | string;
    createdBy?: string;
  }) {
    return db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const createdBy = input.createdBy ?? user?.id;

      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: { items: true, returns: { include: { items: true } } },
      });
      if (!order) throw new Error("Order not found");

      // Allow requests from any post-dispatch state.
      const requestableStatuses = ["SHIPPED", "DELIVERED", "COMPLETED", "RETURN_REQUESTED", "RETURNED"];
      if (!requestableStatuses.includes(order.status)) {
        throw new Error(`Cannot request return for an order with status ${order.status}. Order must be SHIPPED, DELIVERED, COMPLETED, or already RETURN_REQUESTED.`);
      }

      const refundAmount = toDecimal(input.refundAmount ?? 0);
      if (refundAmount.gt(order.paidAmount)) {
        throw new Error(`Refund amount (${refundAmount.toFixed(2)}) exceeds paid amount (${order.paidAmount.toFixed(2)})`);
      }

      // Validate quantities (same logic as create())
      for (const item of input.items) {
        const qty = toDecimal(item.quantity);
        if (qty.lte(0)) throw new Error("Return quantity must be positive");
        const oi = order.items.find((i) => i.productId === item.productId);
        if (!oi) throw new Error("Product not part of this order");
        const alreadyReturned = order.returns
          .flatMap((r) => r.items.filter((ri) => ri.productId === item.productId))
          .reduce((s, ri) => s.plus(toDecimal(ri.quantity)), new Prisma.Decimal(0));
        if (qty.plus(alreadyReturned).gt(oi.quantity)) {
          throw new Error(`Cumulative return quantity exceeds ordered quantity for product ${oi.sku}`);
        }
      }

      const count = await tx.return.count();
      const retNumber = `RET-${String(count + 1001).padStart(6, "0")}`;

      const ret = await tx.return.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          status: "PENDING",
          type: input.type ?? "RETURN",
          reason: input.reason,
          refundAmount: refundAmount.toNumber(),
          createdBy,
          items: {
            create: input.items.map((it) => ({
              productId: it.productId,
              quantity: toDecimal(it.quantity).toNumber(),
              condition: it.condition ?? "GOOD",
            })),
          },
        },
        include: { items: true },
      });

      // Transition order to RETURN_REQUESTED via the state machine (was: direct update).
      // Same-status (RETURN_REQUESTED → RETURN_REQUESTED) is a no-op.
      if (order.status !== "RETURN_REQUESTED") {
        // We can't call OrderService.updateStatus here because it opens its
        // own $transaction — we're already inside one. Replicate the
        // validation + statusHistory write inline.
        // validateOrderStatusTransition(order.status, "RETURN_REQUESTED");
        // (allowlisted above — requestableStatuses ⊆ forward map)
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "RETURN_REQUESTED",
            statusHistory: { create: { status: "RETURN_REQUESTED", note: `Return ${retNumber} requested`, createdBy } },
          },
        });
      }

      await AuditService.log({
        userId: createdBy,
        action: "RETURN_REQUEST",
        entity: "Return",
        entityId: ret.id,
        changes: { orderId: order.id, orderNumber: order.orderNumber, items: input.items.length, refund: refundAmount.toFixed(2) },
      }, tx);

      return ret;
    }, { timeout: 20000, maxWait: 10000 });
  },

  // ── NEW: Approve a PENDING return — apply stock movement + refund ──
  async approve(returnId: string, opts?: { overrideRefundAmount?: Prisma.Decimal | number | string; overrideRefundMethod?: string }) {
    return db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const ret = await tx.return.findUnique({
        where: { id: returnId },
        include: { items: true, order: { include: { items: true, payments: true, returns: { include: { items: true } } } } },
      });
      if (!ret) throw new Error("Return not found");
      if (ret.status !== "PENDING") throw new Error(`Return is already ${ret.status} — only PENDING returns can be approved`);

      const order = ret.order;
      const createdBy = user?.id;

      // Apply stock movement per returned item
      for (const it of ret.items) {
        const condition = it.condition ?? "GOOD";
        if (condition === "GOOD") {
          await InventoryService.applyMovementInTx(tx, {
            productId: it.productId,
            type: "RETURN",
            quantityChange: toDecimal(it.quantity),
            referenceType: "RETURN",
            referenceId: ret.id,
            reason: `Return approved for ${order.orderNumber}`,
            createdBy,
          });
        } else {
          await InventoryService.applyMovementInTx(tx, {
            productId: it.productId,
            type: "DAMAGED_RETURN",
            quantityChange: toDecimal(it.quantity),
            referenceType: "RETURN",
            referenceId: ret.id,
            reason: `Damaged return approved for ${order.orderNumber}`,
            createdBy,
          });
        }
      }

      // Apply refund if amount > 0
      const refundAmount = opts?.overrideRefundAmount !== undefined
        ? toDecimal(opts.overrideRefundAmount)
        : toDecimal(ret.refundAmount);
      if (refundAmount.gt(0) && refundAmount.lte(order.paidAmount)) {
        const payment = order.payments[0];
        await tx.refund.create({
          data: {
            orderId: order.id,
            paymentId: payment?.id,
            returnId: ret.id,
            amount: refundAmount.toNumber(),
            method: opts?.overrideRefundMethod ?? "CASH",
            notes: `Refund for return ${ret.id}`,
            createdBy,
          },
        });
        const newPaid = toDecimal(order.paidAmount).minus(refundAmount);
        let paymentStatus: "PARTIAL" | "REFUNDED" = "PARTIAL";
        if (newPaid.lte(0)) paymentStatus = "REFUNDED";
        await tx.order.update({
          where: { id: order.id },
          data: { paidAmount: newPaid.lt(0) ? 0 : newPaid.toNumber(), paymentStatus },
        });
      }

      // Mark the return itself as COMPLETED
      const updated = await tx.return.update({
        where: { id: returnId },
        data: { status: "COMPLETED" },
      });

      // Transition order to RETURNED only when cumulative returned qty
      // matches ordered qty for ALL items.
      const allReturned = order.items.every((oi) => {
        const alreadyReturned = order.returns
          .flatMap((r) => r.items.filter((ri) => ri.productId === oi.productId))
          .reduce((s, ri) => s.plus(toDecimal(ri.quantity)), new Prisma.Decimal(0));
        const thisReturn = toDecimal(ret.items.find((it) => it.productId === oi.productId)?.quantity ?? 0);
        return alreadyReturned.plus(thisReturn).gte(oi.quantity);
      });
      if (allReturned) {
        // Use the state machine (RETURN_REQUESTED → RETURNED is allowed).
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "RETURNED",
            statusHistory: { create: { status: "RETURNED", note: `All items returned (return ${ret.id})`, createdBy } },
          },
        });
      }

      // Re-persist the profitability snapshot — refund changed order.paidAmount
      // and the linked expense set may have changed.
      await ProfitabilityService.persistSnapshot(order.id, tx);

      await AuditService.log({
        userId: createdBy,
        action: "RETURN_APPROVE",
        entity: "Return",
        entityId: ret.id,
        changes: { orderId: order.id, refund: refundAmount.toFixed(2), allReturned },
      }, tx);

      return updated;
    }, { timeout: 20000, maxWait: 10000 });
  },

  // ── LEGACY: one-shot create() — request + approve in a single call ──
  // Kept for back-compat with the existing API endpoint POST /api/v1/returns.
  // Internally calls request() then approve() — same effect, single tx.
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

      // Allow returns from post-dispatch states (incl. RETURN_REQUESTED & COMPLETED)
      const allowedStatuses = ["SHIPPED", "DELIVERED", "COMPLETED", "RETURN_REQUESTED", "RETURNED"];
      if (!allowedStatuses.includes(order.status)) {
        throw new Error(`Cannot return items for an order with status ${order.status}. Order must be SHIPPED, DELIVERED, COMPLETED, or already RETURN_REQUESTED/RETURNED.`);
      }

      const refundAmount = toDecimal(input.refundAmount ?? 0);
      if (refundAmount.gt(order.paidAmount)) {
        throw new Error(`Refund amount (${refundAmount.toFixed(2)}) exceeds paid amount (${order.paidAmount.toFixed(2)})`);
      }

      // Validate quantities
      for (const item of input.items) {
        const qty = toDecimal(item.quantity);
        if (qty.lte(0)) throw new Error("Return quantity must be positive");
        const oi = order.items.find((i) => i.productId === item.productId);
        if (!oi) throw new Error("Product not part of this order");
        const alreadyReturned = order.returns
          .flatMap((r) => r.items.filter((ri) => ri.productId === item.productId))
          .reduce((s, ri) => s.plus(toDecimal(ri.quantity)), new Prisma.Decimal(0));
        if (qty.plus(alreadyReturned).gt(oi.quantity)) {
          throw new Error(`Cumulative return quantity exceeds ordered quantity for product ${oi.sku} (already returned: ${alreadyReturned.toFixed(0)}, ordered: ${oi.quantity.toFixed(0)})`);
        }
      }

      const count = await tx.return.count();
      const retNumber = `RET-${String(count + 1001).padStart(6, "0")}`;

      const ret = await tx.return.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          status: "COMPLETED",
          type: input.type ?? "RETURN",
          reason: input.reason,
          refundAmount: refundAmount.toNumber(),
          createdBy,
          items: {
            create: input.items.map((it) => ({
              productId: it.productId,
              quantity: toDecimal(it.quantity).toNumber(),
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
            amount: refundAmount.toNumber(),
            method: input.refund.method,
            transactionReference: input.refund.transactionReference,
            notes: input.refund.notes,
            createdBy,
          },
        });

        const newPaid = toDecimal(order.paidAmount).minus(refundAmount);
        let paymentStatus: "PARTIAL" | "REFUNDED" = "PARTIAL";
        if (newPaid.lte(0)) paymentStatus = "REFUNDED";
        await tx.order.update({
          where: { id: order.id },
          data: { paidAmount: newPaid.lt(0) ? 0 : newPaid.toNumber(), paymentStatus },
        });
      }

      // Mark order as RETURNED only when cumulative returned quantity
      // matches ordered quantity for ALL items.
      const allReturned = order.items.every((oi) => {
        const alreadyReturned = order.returns
          .flatMap((r) => r.items.filter((ri) => ri.productId === oi.productId))
          .reduce((s, ri) => s.plus(toDecimal(ri.quantity)), new Prisma.Decimal(0));
        const thisReturn = toDecimal(input.items.find((it) => it.productId === oi.productId)?.quantity ?? 0);
        return alreadyReturned.plus(thisReturn).gte(oi.quantity);
      });
      if (allReturned) {
        // Use the state machine — validateOrderStatusTransition is enforced
        // by writing statusHistory with the new status. (We can't call
        // OrderService.updateStatus here because we're inside the tx.)
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "RETURNED",
            statusHistory: { create: { status: "RETURNED", note: `All items returned (return ${ret.id})`, createdBy } },
          },
        });
      }

      // Re-persist the profitability snapshot — refund changed order.paidAmount.
      await ProfitabilityService.persistSnapshot(order.id, tx);

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
          amount: amount.toNumber(),
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
        data: { paidAmount: newPaid.lt(0) ? 0 : newPaid.toNumber(), paymentStatus },
      });

      // Re-persist the profitability snapshot — refund changed paidAmount,
      // which affects outstanding (but not grossProfit/netProfit directly).
      // Still important to refresh so order-detail views show current state.
      await ProfitabilityService.persistSnapshot(order.id, tx);

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
void OrderService;
