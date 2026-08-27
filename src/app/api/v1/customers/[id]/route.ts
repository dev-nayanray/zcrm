import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError, validationError, notFound, forbidden } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { toDecimal } from "@/lib/decimal";
import { updateCustomerSchema } from "@/lib/validation";
import { AuditService } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("customers:read");
    if (err) return err;
    const { id } = await ctx.params;
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        orders: { orderBy: { createdAt: "desc" }, take: 50, include: { channel: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 50 },
        returns: { take: 50, include: { items: true } },
        conversations: { orderBy: { lastMessageAt: "desc" }, take: 20, select: { id: true, provider: true, contactName: true, lastMessagePreview: true, status: true, lastMessageAt: true } },
        leads: { take: 20, select: { id: true, name: true, campaign: true, status: true, createdAt: true } },
      },
    });
    if (!customer) return notFound("Customer not found");

    const orderAgg = await db.order.aggregate({ where: { customerId: id }, _sum: { total: true }, _count: true });
    const payAgg = await db.payment.aggregate({ where: { customerId: id }, _sum: { amount: true } });
    const totalSpending = toDecimal(orderAgg._sum.total);
    const totalPaid = toDecimal(payAgg._sum.amount);
    const outstanding = totalSpending.minus(totalPaid).lt(0) ? new Prisma.Decimal(0) : totalSpending.minus(totalPaid);

    return ok({
      ...customer,
      totalOrders: orderAgg._count,
      totalSpending: totalSpending.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      outstanding: outstanding.toFixed(2),
      lifetimeValue: totalPaid.toFixed(2),
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("customers:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody(request);
    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) return notFound("Customer not found");

    if (parsed.data.phone && parsed.data.phone !== existing.phone) {
      const conflict = await db.customer.findUnique({ where: { phone: parsed.data.phone } });
      if (conflict) return forbidden("Phone already in use");
    }
    const updated = await db.customer.update({ where: { id }, data: parsed.data });
    await AuditService.log({ userId: user!.id, action: "CUSTOMER_UPDATE", entity: "Customer", entityId: id, changes: parsed.data });
    return ok(updated);
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("customers:delete");
    if (err) return err;
    const { id } = await ctx.params;
    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) return notFound("Customer not found");
    // Prevent delete if has orders
    const orderCount = await db.order.count({ where: { customerId: id } });
    if (orderCount > 0) return forbidden("Cannot delete customer with existing orders");
    await db.customer.delete({ where: { id } });
    await AuditService.log({ userId: user!.id, action: "CUSTOMER_DELETE", entity: "Customer", entityId: id });
    return ok({ success: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
