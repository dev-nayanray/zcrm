import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal, cmpMoney } from "@/lib/decimal";
import { getCurrentUser } from "@/lib/auth";
import { AuditService } from "./audit";

// PaymentService — single source for payment recording & payment status calculation.
// Payment status is ALWAYS recomputed from actual payment records, never trusted
// from the frontend.
//
// INTEGRITY GUARDS:
//   1. Rejects payments on CANCELLED or REFUNDED orders (terminal states —
//      no further financial activity is permitted).
//   2. Rejects payments on RETURN_REQUESTED orders (the return flow must
//      complete first).
//   3. Prevents overpayment (cumulative paid + new amount ≤ order total).
//   4. Idempotent on `transactionReference` — if the same reference (e.g.
//      a bKash trxId) is submitted twice, the second submission returns
//      the existing payment record instead of creating a duplicate.
//   5. Audit log fires inside the transaction (rolls back together).
//   6. PAYMENT_RECEIVED automation + Telegram routing fire post-commit.
export const PaymentService = {
  async create(input: {
    orderId: string;
    amount: Prisma.Decimal | number | string;
    method: string;
    transactionReference?: string;
    notes?: string;
    createdBy?: string;
  }) {
    // Capture order context for the post-commit automation trigger.
    let orderCtx = { id: input.orderId, orderNumber: "", total: new Prisma.Decimal(0) };

    // ── Idempotency: if a transactionReference is provided, check for an
    // existing payment with the same reference BEFORE opening a transaction.
    // This prevents duplicate payments from webhook redeliveries, double-
    // clicks, or retry logic. Returns the existing record instead of creating
    // a duplicate.
    if (input.transactionReference && input.transactionReference.trim() !== "") {
      const existing = await db.payment.findFirst({
        where: { orderId: input.orderId, transactionReference: input.transactionReference },
      });
      if (existing) return existing;
    }

    return db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const createdBy = input.createdBy ?? user?.id;

      const order = await tx.order.findUnique({ where: { id: input.orderId } });
      if (!order) throw new Error("Order not found");
      orderCtx = { id: order.id, orderNumber: order.orderNumber, total: toDecimal(order.total) };

      // Reject payments on terminal / pending-return states.
      // - CANCELLED: the order is dead — no money should change hands.
      // - REFUNDED: the order is fully refunded — additional payments make
      //   no sense; if the customer is re-purchasing, create a NEW order.
      // - RETURN_REQUESTED: the return flow must complete (RETURNED →
      //   optionally REFUNDED) before any new payment is accepted.
      const rejectedStatuses = ["CANCELLED", "REFUNDED", "RETURN_REQUESTED"];
      if (rejectedStatuses.includes(order.status)) {
        throw new Error(`Cannot record payment on order with status ${order.status}.`);
      }

      const amount = toDecimal(input.amount);
      if (amount.lte(0)) throw new Error("Payment amount must be positive");

      // Already paid sum
      const agg = await tx.payment.aggregate({
        where: { orderId: order.id },
        _sum: { amount: true },
      });
      const alreadyPaid = toDecimal(agg._sum.amount ?? 0);
      const total = toDecimal(order.total);
      // Overpayment prevention
      if (alreadyPaid.plus(amount).gt(total)) {
        throw new Error(
          `Payment exceeds outstanding amount. Outstanding: ${(total.minus(alreadyPaid)).toFixed(2)}`,
        );
      }

      // Re-check idempotency INSIDE the transaction (the pre-tx check above
      // is a TOCTOU optimisation; this is the authoritative check that
      // prevents races between two concurrent submissions of the same ref).
      if (input.transactionReference && input.transactionReference.trim() !== "") {
        const existingInTx = await tx.payment.findFirst({
          where: { orderId: order.id, transactionReference: input.transactionReference },
        });
        if (existingInTx) return existingInTx;
      }

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          // Schema stores Float — convert Decimal via toNumber().
          amount: amount.toNumber(),
          method: input.method,
          transactionReference: input.transactionReference,
          notes: input.notes,
          createdBy,
        },
      });

      const newPaid = alreadyPaid.plus(amount);
      let status = "UNPAID";
      if (newPaid.gte(total)) status = "PAID";
      else if (newPaid.gt(0)) status = "PARTIAL";

      await tx.order.update({
        where: { id: order.id },
        data: { paidAmount: newPaid.toNumber(), paymentStatus: status },
      });

      await AuditService.log({
        userId: createdBy,
        action: "PAYMENT_CREATE",
        entity: "Payment",
        entityId: payment.id,
        changes: { orderId: order.id, amount: amount.toFixed(2), method: input.method, transactionReference: input.transactionReference },
      }, tx);

      return payment;
    }, { timeout: 20000, maxWait: 10000 }).then((result) => {
      // Fire PAYMENT_RECEIVED automation AFTER commit (non-blocking).
      try {
        void (import("./automation").then(({ AutomationService }) =>
          AutomationService.trigger("PAYMENT_RECEIVED", {
            entityId: orderCtx.id,
            variables: { order_number: orderCtx.orderNumber, order_total: orderCtx.total.toFixed(2), business_name: "Z-CRM" },
          }),
        ));
        // Also route to Telegram groups (non-blocking)
        void (import("./telegram").then(({ TelegramService }) =>
          TelegramService.routeNotification("PAYMENT_RECEIVED", `💰 <b>PAYMENT RECEIVED</b>\nOrder: ${orderCtx.orderNumber} · ${orderCtx.total.toFixed(2)} BDT`)
        ).catch(() => {}));
      } catch (e) { console.error("[PaymentService] automation trigger failed:", e); }
      return result;
    });
  },

  async forOrder(orderId: string) {
    return db.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
      include: { creator: { select: { id: true, name: true } } },
    });
  },

  async list(opts: { page: number; limit: number; search?: string; method?: string; orderId?: string; customerId?: string; from?: Date; to?: Date }) {
    const { page, limit, search, method, orderId, customerId, from, to } = opts;
    const where: Record<string, unknown> = { AND: [] };
    const and: Record<string, unknown>[] = [];
    if (search) and.push({ transactionReference: { contains: search } });
    if (method) and.push({ method });
    if (orderId) and.push({ orderId });
    if (customerId) and.push({ customerId });
    if (from || to) {
      const created: Record<string, Date> = {};
      if (from) created.gte = from;
      if (to) created.lte = to;
      and.push({ createdAt: created });
    }
    where.AND = and;
    const [items, total] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order: { select: { id: true, orderNumber: true } },
          customer: { select: { id: true, name: true, phone: true } },
          creator: { select: { id: true, name: true } },
        },
      }),
      db.payment.count({ where }),
    ]);
    return { items, total };
  },
};
