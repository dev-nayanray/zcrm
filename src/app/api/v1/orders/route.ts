import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { createOrderSchema } from "@/lib/validation";
import { OrderService } from "@/lib/services/order";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("orders:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const paymentStatus = request.nextUrl.searchParams.get("paymentStatus") || undefined;
    const channelId = request.nextUrl.searchParams.get("channelId") || undefined;
    const customerId = request.nextUrl.searchParams.get("customerId") || undefined;
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

    const where: Prisma.OrderWhereInput = {};
    if (q.search) {
      where.OR = [{ orderNumber: { contains: q.search } }, { notes: { contains: q.search } }];
    }
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (channelId) where.channelId = channelId;
    if (customerId) where.customerId = customerId;
    if (from || to) {
      const created: Record<string, Date> = {};
      if (from) created.gte = new Date(from);
      if (to) created.lte = new Date(to);
      where.createdAt = created;
    }

    const [items, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          channel: { select: { id: true, name: true } },
          _count: { select: { items: true } },
          creator: { select: { id: true, name: true } },
        },
      }),
      db.order.count({ where }),
    ]);

    return ok({
      items: items.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        subtotal: o.subtotal.toFixed(2),
        discount: o.discount.toFixed(2),
        shippingCost: o.shippingCost.toFixed(2),
        otherCost: o.otherCost.toFixed(2),
        total: o.total.toFixed(2),
        paidAmount: o.paidAmount.toFixed(2),
        customer: o.customer,
        channel: o.channel,
        creator: o.creator,
        itemCount: o._count.items,
        externalId: o.externalId,
        syncStatus: o.syncStatus,
        sourceChannel: o.sourceChannel,
        createdAt: o.createdAt,
      })),
      total,
      page: q.page,
      limit: q.limit,
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("orders:create");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    try {
      const order = await OrderService.create(parsed.data);
      return ok(order);
    } catch (e) {
      return badRequest((e as Error).message);
    }
  } catch (e) {
    return serverError((e as Error).message);
  }
}
