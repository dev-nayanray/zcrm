import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { addMoney, mulMoney, subMoney, toDecimal, cmpMoney } from "@/lib/decimal";
import { InventoryService } from "./inventory";
import { AuditService } from "./audit";
import { getCurrentUser } from "@/lib/auth";
import { WooCommerceService } from "./woocommerce";
import { CostingService } from "./costing";
import { ProfitabilityService } from "./profitability";

// Lazy-import AutomationService to avoid a circular import at module load.
// Automation triggers are fire-and-forget and NEVER block the order transaction.
async function fireAutomation(event: string, ctx: { entityId?: string; variables?: Record<string, string> }) {
  try {
    const { AutomationService } = await import("./automation");
    void AutomationService.trigger(event, ctx);
  } catch (e) {
    console.error("[OrderService] automation trigger failed:", e);
  }
  // Also route to Telegram groups (non-blocking)
  try {
    const { TelegramService } = await import("./telegram");
    const msg = `${event === "ORDER_CREATED" ? "🆕" : "📦"} <b>${event.replace(/_/g, " ")}</b>\nOrder: ${ctx.variables?.order_number ?? ""} · ${ctx.variables?.customer_name ?? ""} · ${ctx.variables?.order_total ?? ""} BDT`;
    void TelegramService.routeNotification(event, msg);
  } catch { /* ignore */ }
}

// Order status machine. Rejects backward / nonsensical transitions so the
// Kanban DnD and any direct PATCH cannot bypass the workflow. Same-status
// updates are no-ops (allowed for idempotency).
//
// Allowed transitions:
//   PENDING     → CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED
//   CONFIRMED    → PROCESSING, SHIPPED, DELIVERED, CANCELLED
//   PROCESSING  → SHIPPED, DELIVERED, CANCELLED
//   SHIPPED     → DELIVERED, RETURNED, CANCELLED
//   DELIVERED   → RETURNED, REFUNDED
//   RETURNED    → REFUNDED
//   CANCELLED   → (terminal — no transitions out)
//   REFUNDED    → (terminal — no transitions out)
//
// Same-status is always allowed (no-op).
const ORDER_FORWARD: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"],
  PROCESSING: ["READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"],
  READY_TO_SHIP: ["SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "COMPLETED", "RETURN_REQUESTED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "RETURN_REQUESTED", "RETURNED", "REFUNDED"],
  COMPLETED: ["RETURN_REQUESTED", "RETURNED", "REFUNDED"],
  RETURN_REQUESTED: ["RETURNED", "CANCELLED"],
  RETURNED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function validateOrderStatusTransition(from: string, to: string): void {
  if (from === to) return; // idempotent no-op
  const allowed = ORDER_FORWARD[from];
  if (!allowed || allowed.length === 0) {
    throw new Error(`Order is in terminal status ${from} — no further transitions are allowed.`);
  }
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid status transition: ${from} → ${to}. Allowed from ${from}: ${allowed.join(", ")}.`,
    );
  }
}

// OrderService — the single source of truth for order creation & totals.
// The backend ALWAYS re-derives product name/sku/unitPrice/unitCost from the DB
// and recalculates subtotal/discount/total. Frontend-supplied totals are ignored.
export const OrderService = {
  async create(input: {
    customerId: string;
    channelId?: string;
    status?: string;
    discount?: Prisma.Decimal | number | string;
    tax?: Prisma.Decimal | number | string;            // sales tax / VAT
    shippingCost?: Prisma.Decimal | number | string;   // shipping income (customer charge)
    otherIncome?: Prisma.Decimal | number | string;   // gift wrap, surcharges
    otherCost?: Prisma.Decimal | number | string;
    packagingCost?: Prisma.Decimal | number | string;  // packaging materials
    paymentFee?: Prisma.Decimal | number | string;    // gateway fee
    platformFee?: Prisma.Decimal | number | string;   // marketplace commission
    notes?: string;
    sourceChannel?: string;
    externalId?: string;
    items: { productId: string; quantity: Prisma.Decimal | number | string; discount?: Prisma.Decimal | number | string }[];
    payment?: { amount: Prisma.Decimal | number | string; method: string; transactionReference?: string; notes?: string };
    createdBy?: string;
    syncStatus?: string;
    reserveStock?: boolean;       // if true → RESERVATION movements (not SALE); convert on DELIVERED
    conversationId?: string;      // link to omnichannel conversation
  }) {
    // ── Idempotency: if externalId is provided and an order already exists
    // with that externalId, return the existing order instead of creating a
    // duplicate. This is critical for webhook redeliveries (WooCommerce can
    // retry a webhook delivery up to 3× in 24h) and for any client retry
    // logic. The Order.externalId column is `@unique` (sparse) so the DB
    // also enforces this constraint at write time.
    if (input.externalId) {
      const existing = await db.order.findUnique({ where: { externalId: input.externalId }, include: { items: true, customer: true, channel: true } });
      if (existing) return existing;
    }

    return db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const createdBy = input.createdBy ?? user?.id;

      // Resolve channel (default to "Website")
      let channelId = input.channelId;
      if (!channelId) {
        const ch = await tx.channel.findFirst({ where: { name: "Website" } });
        channelId = ch?.id;
        if (!channelId) {
          const created = await tx.channel.create({ data: { name: "Website", isSystem: true } });
          channelId = created.id;
        }
      }

      // Validate customer exists
      const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) throw new Error("Customer not found");

      // Snapshot product data from DB. Validate every item.
      const lineItems: {
        productId: string;
        productName: string;
        sku: string;
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        unitCost: Prisma.Decimal;
        discount: Prisma.Decimal;
        total: Prisma.Decimal;
      }[] = [];
      let subtotal = new Prisma.Decimal(0);
      let totalCost = new Prisma.Decimal(0);

      for (const item of input.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error(`Product not found: ${item.productId}`);
        if (product.status !== "ACTIVE") throw new Error(`Product is not active: ${product.sku}`);

        const qty = toDecimal(item.quantity);
        if (qty.lte(0)) throw new Error(`Quantity must be positive for ${product.sku}`);

        const unitPrice = toDecimal(product.sellingPrice);
        // COGS basis: prefer Weighted Average Cost (WAC); fall back to
        // purchasePrice for products seeded before WAC was implemented.
        const unitCost = await CostingService.getCostBasisInTx(tx, item.productId);
        const lineDiscount = toDecimal(item.discount ?? 0);
        const lineTotal = qty.times(unitPrice).minus(lineDiscount);
        if (lineTotal.lt(0)) throw new Error(`Line total negative for ${product.sku}`);

        subtotal = subtotal.add(lineTotal);
        totalCost = totalCost.add(qty.times(unitCost));
        lineItems.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: qty,
          unitPrice,
          unitCost,
          discount: lineDiscount,
          total: lineTotal,
        });
      }

      const discount = toDecimal(input.discount ?? 0);
      const tax = toDecimal(input.tax ?? 0);
      const shippingCost = toDecimal(input.shippingCost ?? 0);
      const otherIncome = toDecimal(input.otherIncome ?? 0);
      const otherCost = toDecimal(input.otherCost ?? 0);
      const packagingCost = toDecimal(input.packagingCost ?? 0);
      const paymentFee = toDecimal(input.paymentFee ?? 0);
      const platformFee = toDecimal(input.platformFee ?? 0);
      // NET SALES = subtotal − discount + tax + shippingCost + otherIncome + otherCost
      const total = subtotal.minus(discount).plus(tax).plus(shippingCost).plus(otherIncome).plus(otherCost);
      if (total.lt(0)) throw new Error("Order total cannot be negative");

      // Generate order number
      const count = await tx.order.count();
      const orderNumber = `ORD-${String(count + 1001).padStart(6, "0")}`;

      const status = input.status ?? "PENDING";

      // Create order
      const reserveStock = input.reserveStock === true;
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          channelId: channelId!,
          status,
          paymentStatus: "UNPAID",
          // Schema stores Float — convert Decimals via toNumber() for write.
          // The arithmetic above preserved precision; storage rounds to float64.
          subtotal: subtotal.toNumber(),
          discount: discount.toNumber(),
          tax: tax.toNumber(),
          shippingCost: shippingCost.toNumber(),
          otherIncome: otherIncome.toNumber(),
          otherCost: otherCost.toNumber(),
          packagingCost: packagingCost.toNumber(),
          paymentFee: paymentFee.toNumber(),
          platformFee: platformFee.toNumber(),
          total: total.toNumber(),
          paidAmount: 0,
          externalId: input.externalId,
          syncStatus: input.syncStatus ?? "LOCAL",
          sourceChannel: input.sourceChannel,
          stockReserved: reserveStock,
          conversationId: input.conversationId ?? null,
          notes: input.notes,
          createdBy,
          items: { create: lineItems.map((li) => ({
            productId: li.productId,
            productName: li.productName,
            sku: li.sku,
            quantity: li.quantity.toNumber(),
            unitPrice: li.unitPrice.toNumber(),
            unitCost: li.unitCost.toNumber(),
            discount: li.discount.toNumber(),
            total: li.total.toNumber(),
          })) },
          statusHistory: {
            create: { status, note: reserveStock ? "Order created (stock reserved)" : "Order created", createdBy },
          },
        },
        include: { items: true },
      });

      // ── Compute & persist the profitability snapshot ──
      // This must run AFTER the order + items + any linked expenses exist
      // in the tx so that ProfitabilityService.computeOrderSnapshot can
      // read them. The snapshot (cogsTotal, grossProfit, netProfit) is then
      // persisted on the order row for fast dashboard/report queries.
      await ProfitabilityService.persistSnapshot(order.id, tx);

      // Stock movement: RESERVATION (if reserveStock) or SALE (default) per line.
      for (const li of lineItems) {
        if (reserveStock) {
          await InventoryService.reserveInTx(tx, {
            productId: li.productId,
            quantity: li.quantity,
            referenceId: order.id,
            reason: `Reservation for ${orderNumber}`,
            createdBy,
          });
        } else {
          await InventoryService.applyMovementInTx(tx, {
            productId: li.productId,
            type: "SALE",
            quantityChange: li.quantity.negated(),
            referenceType: "ORDER",
            referenceId: order.id,
            reason: `Sale ${orderNumber}`,
            createdBy,
          });
        }
      }

      // Apply payment if provided
      let paidAmount = new Prisma.Decimal(0);
      let paymentStatus = "UNPAID";
      if (input.payment && cmpMoney(input.payment.amount, 0) > 0) {
        const pmtAmt = toDecimal(input.payment.amount);
        if (pmtAmt.gt(total)) throw new Error("Payment exceeds order total");
        await tx.payment.create({
          data: {
            orderId: order.id,
            customerId: customer.id,
            // Schema stores Float — convert Decimal via toNumber().
            amount: pmtAmt.toNumber(),
            method: input.payment.method,
            transactionReference: input.payment.transactionReference,
            notes: input.payment.notes,
            createdBy,
          },
        });
        paidAmount = paidAmount.plus(pmtAmt);
        if (paidAmount.gte(total)) paymentStatus = "PAID";
        else paymentStatus = "PARTIAL";
        await tx.order.update({
          where: { id: order.id },
          data: { paidAmount: paidAmount.toNumber(), paymentStatus },
        });
      }

      await AuditService.log({
        userId: createdBy,
        action: "ORDER_CREATE",
        entity: "Order",
        entityId: order.id,
        changes: { orderNumber, total: total.toFixed(2), items: lineItems.length },
      }, tx);

      return tx.order.findUnique({ where: { id: order.id }, include: { items: true, customer: true, channel: true } });
    }, { timeout: 20000, maxWait: 10000 }).then((result) => {
      // Fire ORDER_CREATED automation AFTER the transaction commits (non-blocking).
      if (result) {
        void fireAutomation("ORDER_CREATED", {
          entityId: result.id,
          variables: {
            customer_name: result.customer?.name ?? "Customer",
            order_number: result.orderNumber,
            order_total: (result.total as any).toFixed ? (result.total as any).toFixed(2) : String(result.total),
            business_name: "Z-CRM",
          },
        });
      }
      return result;
    });
  },

  async updateStatus(orderId: string, status: string, note?: string) {
    return db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("Order not found");

      // Status transition validation. Reject backward / nonsensical
      // transitions so the Kanban DnD (and any direct PATCH) cannot
      // bypass the workflow. Same-status updates are no-ops (allowed
      // for idempotency). Forward transitions within the workflow are
      // allowed; transitions from terminal states (CANCELLED, REFUNDED)
      // are rejected.
      validateOrderStatusTransition(order.status, status);

      // If cancelling a previously-shipped/sold order, we may need to return stock.
      // For simplicity, when moving to CANCELLED we restore stock if it was deducted
      // (only when coming from PENDING/CONFIRMED/PROCESSING/SHIPPED — not DELIVERED).
      const previouslyActive = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"].includes(order.status);

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status,
          statusHistory: { create: { status, note, createdBy: user?.id } },
        },
      });

      if (status === "CANCELLED" && previouslyActive) {
        // Order cancelled — restore stock.
        // If stock was RESERVED (not yet sold): RELEASE the reservation.
        // If stock was SOLD (SALE movement already applied): RETURN it.
        const items = await tx.orderItem.findMany({ where: { orderId } });
        for (const it of items) {
          if (order.stockReserved) {
            await InventoryService.releaseInTx(tx, {
              productId: it.productId,
              quantity: it.quantity,
              referenceId: orderId,
              reason: `Reservation released — order ${order.orderNumber} cancelled`,
              createdBy: user?.id,
            });
          } else {
            await InventoryService.applyMovementInTx(tx, {
              productId: it.productId,
              type: "RETURN",
              quantityChange: it.quantity,
              referenceType: "ORDER",
              referenceId: orderId,
              reason: `Order ${order.orderNumber} cancelled`,
              createdBy: user?.id,
            });
          }
        }
        // Mark reservation cleared
        if (order.stockReserved) {
          await tx.order.update({ where: { id: orderId }, data: { stockReserved: false } });
        }
      }

      // Fulfil: convert any reservation into an actual SALE
      if (status === "DELIVERED" && order.stockReserved) {
        const items = await tx.orderItem.findMany({ where: { orderId } });
        for (const it of items) {
          await InventoryService.convertReservationToSaleInTx(tx, {
            productId: it.productId,
            quantity: it.quantity,
            referenceId: orderId,
            reason: `Order ${order.orderNumber} delivered`,
            createdBy: user?.id,
          });
        }
        await tx.order.update({ where: { id: orderId }, data: { stockReserved: false } });
      }

      await AuditService.log({
        userId: user?.id,
        action: "ORDER_UPDATE",
        entity: "Order",
        entityId: orderId,
        changes: { from: order.status, to: status, note },
      }, tx);

      return updated;
    }, { timeout: 20000, maxWait: 10000 }).then((result) => {
      // Fire status-change automation AFTER commit (non-blocking).
      const eventMap: Record<string, string> = {
        SHIPPED: "ORDER_SHIPPED",
        DELIVERED: "ORDER_DELIVERED",
        CANCELLED: "ORDER_CANCELLED",
      };
      const evt = eventMap[status];
      if (evt && result) {
        void fireAutomation(evt, { entityId: orderId, variables: { order_number: (result as any).orderNumber ?? orderId, business_name: "Z-CRM" } });
      }
      // Push the status update back to WooCommerce (fire-and-forget).
      // Only relevant for orders that originated in Woo (have externalId).
      // Failures are logged to SyncLog — they never break the CRM operation.
      if (result) {
        void WooCommerceService.pushOrderStatus(orderId, status).catch(() => {});
      }
      return result;
    });
  },

  // Recompute payment status from actual payment records (idempotent).
  async recomputePaymentStatus(orderId: string) {
    return db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) return;
      const agg = await tx.payment.aggregate({
        where: { orderId },
        _sum: { amount: true },
      });
      const paid = toDecimal(agg._sum.amount ?? 0);
      const total = toDecimal(order.total);
      let status = "UNPAID";
      if (paid.gte(total) && total.gt(0)) status = "PAID";
      else if (paid.gt(0)) status = "PARTIAL";
      await tx.order.update({
        where: { id: orderId },
        data: { paidAmount: paid.toNumber(), paymentStatus: status },
      });
    });
  },
};
