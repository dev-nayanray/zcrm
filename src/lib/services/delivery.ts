import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";
import { InventoryService } from "./inventory";
import { AuditService } from "./audit";
import { getCurrentUser } from "@/lib/auth";

// DeliveryService — manages order deliveries and the courier abstraction.
// Delivery statuses: PENDING|PACKED|SHIPPED|IN_TRANSIT|DELIVERED|FAILED|RETURNED
// When a delivery is marked DELIVERED, the underlying order is also moved to
// DELIVERED — which triggers OrderService's reservation→SALE conversion via
// the same InventoryService (no duplicate logic).
export const DeliveryService = {
  async list(opts: { page: number; limit: number; status?: string; search?: string; courierProviderId?: string }) {
    const where: Prisma.DeliveryWhereInput = {};
    if (opts.status) where.status = opts.status;
    if (opts.courierProviderId) where.courierProviderId = opts.courierProviderId;
    if (opts.search) {
      where.OR = [
        { trackingNumber: { contains: opts.search } },
        { recipientName: { contains: opts.search } },
        { recipientPhone: { contains: opts.search } },
        { order: { orderNumber: { contains: opts.search } } },
      ];
    }
    const [items, total] = await Promise.all([
      db.delivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        include: {
          order: { select: { id: true, orderNumber: true, total: true, customer: { select: { id: true, name: true, phone: true } } } },
          courierProvider: { select: { id: true, name: true } },
        },
      }),
      db.delivery.count({ where }),
    ]);
    return { items, total };
  },

  async get(id: string) {
    return db.delivery.findUnique({
      where: { id },
      include: {
        order: { include: { customer: true, items: true, channel: true } },
        courierProvider: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    });
  },

  async forOrder(orderId: string) {
    return db.delivery.findUnique({ where: { orderId }, include: { courierProvider: true, statusHistory: { orderBy: { createdAt: "asc" } } } });
  },

  async create(input: {
    orderId: string;
    courierProviderId?: string;
    courierName?: string;
    trackingNumber?: string;
    deliveryCharge?: Prisma.Decimal | number | string;
    codAmount?: Prisma.Decimal | number | string;
    recipientName?: string;
    recipientPhone?: string;
    recipientAddress?: string;
    shippingDate?: Date;
    notes?: string;
    createdBy?: string;
    autoShip?: boolean; // if true, immediately create courier shipment
  }) {
    return db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const createdBy = input.createdBy ?? user?.id;
      const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { customer: true } });
      if (!order) throw new Error("Order not found");
      const existing = await tx.delivery.findUnique({ where: { orderId: order.id } });
      if (existing) throw new Error("Delivery already exists for this order");

      const delivery = await tx.delivery.create({
        data: {
          orderId: order.id,
          courierProviderId: input.courierProviderId ?? null,
          courierName: input.courierName,
          trackingNumber: input.trackingNumber,
          deliveryCharge: toDecimal(input.deliveryCharge ?? order.shippingCost),
          codAmount: toDecimal(input.codAmount ?? order.total),
          status: input.autoShip ? "SHIPPED" : "PENDING",
          recipientName: input.recipientName ?? order.customer?.name,
          recipientPhone: input.recipientPhone ?? order.customer?.phone,
          recipientAddress: input.recipientAddress ?? order.customer?.address,
          shippingDate: input.shippingDate ?? (input.autoShip ? new Date() : null),
          notes: input.notes,
          createdBy,
          statusHistory: { create: { status: input.autoShip ? "SHIPPED" : "PENDING", note: "Delivery created" } },
        },
        include: { order: true },
      });

      // If auto-ship and a courier provider is configured, attempt to create a shipment.
      if (input.autoShip && input.courierProviderId) {
        try {
          const { CourierService } = await import("./courier");
          const shipment = await CourierService.createShipment({
            providerId: input.courierProviderId,
            deliveryId: delivery.id,
            recipientName: delivery.recipientName ?? "",
            recipientPhone: delivery.recipientPhone ?? "",
            recipientAddress: delivery.recipientAddress ?? "",
            codAmount: delivery.codAmount,
            orderId: order.id,
          });
          await tx.delivery.update({
            where: { id: delivery.id },
            data: { courierConsignmentId: shipment.consignmentId, trackingNumber: delivery.trackingNumber ?? shipment.trackingNumber },
          });
        } catch (e) {
          // non-fatal — record the error in the status history
          await tx.deliveryStatusHistory.create({ data: { deliveryId: delivery.id, status: "PENDING", note: `Courier shipment failed: ${(e as Error).message}` } });
        }
      }

      await AuditService.log({ userId: createdBy, action: "DELIVERY_CREATE", entity: "Delivery", entityId: delivery.id, changes: { orderId: order.id } }, tx);
      return tx.delivery.findUnique({ where: { id: delivery.id }, include: { order: true, courierProvider: true, statusHistory: true } });
    }, { timeout: 20000, maxWait: 10000 });
  },

  async updateStatus(deliveryId: string, status: string, note?: string) {
    let orderCtx = { orderId: "", shouldSync: false };
    const result = await db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const delivery = await tx.delivery.findUnique({ where: { id: deliveryId } });
      if (!delivery) throw new Error("Delivery not found");

      const updated = await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          status,
          statusHistory: { create: { status, note } },
          shippingDate: status === "SHIPPED" && !delivery.shippingDate ? new Date() : undefined,
          deliveredDate: status === "DELIVERED" ? new Date() : undefined,
        },
      });

      // Note: we do NOT call OrderService.updateStatus here because that would
      // open a NESTED db.$transaction (SQLite single-writer deadlock). Instead
      // we sync the order status AFTER the delivery transaction commits.
      if ((status === "DELIVERED" || status === "RETURNED") && delivery.orderId) {
        orderCtx = { orderId: delivery.orderId, shouldSync: true };
      }

      await AuditService.log({ userId: user?.id, action: "DELIVERY_UPDATE", entity: "Delivery", entityId: deliveryId, changes: { status, note } }, tx);
      return updated;
    }, { timeout: 20000, maxWait: 10000 });

    // After the delivery transaction commits, sync the order status. This
    // triggers OrderService's reservation→SALE conversion via InventoryService
    // (a SEPARATE transaction — no nested-transaction deadlock).
    if (orderCtx.shouldSync && orderCtx.orderId) {
      try {
        const { OrderService } = await import("./order");
        const orderStatus = status === "DELIVERED" ? "DELIVERED" : "RETURNED";
        await OrderService.updateStatus(orderCtx.orderId, orderStatus, `Delivery ${deliveryId} ${status.toLowerCase()}`);
      } catch (e) {
        console.error("[DeliveryService] order status sync failed:", e);
      }
    }
    return result;
  },

  async dashboard() {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const where = { shippingDate: { gte: todayStart, lte: todayEnd } };
    const [total, pending, packed, shipped, inTransit, delivered, failed, returned, codAgg] = await Promise.all([
      db.delivery.count(),
      db.delivery.count({ where: { status: "PENDING" } }),
      db.delivery.count({ where: { status: "PACKED" } }),
      db.delivery.count({ where: { status: "SHIPPED" } }),
      db.delivery.count({ where: { status: "IN_TRANSIT" } }),
      db.delivery.count({ where: { status: "DELIVERED" } }),
      db.delivery.count({ where: { status: "FAILED" } }),
      db.delivery.count({ where: { status: "RETURNED" } }),
      db.delivery.aggregate({ where, _sum: { codAmount: true, deliveryCharge: true } }),
    ]);
    return {
      total, pending, packed, shipped, inTransit, delivered, failed, returned,
      codToday: (codAgg._sum.codAmount ?? new Prisma.Decimal(0)).toFixed(2),
      deliveryChargeToday: (codAgg._sum.deliveryCharge ?? new Prisma.Decimal(0)).toFixed(2),
    };
  },
};

void toDecimal; void InventoryService;
