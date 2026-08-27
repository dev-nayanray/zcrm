import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { createCustomerSchema } from "@/lib/validation";
import { toDecimal } from "@/lib/decimal";
import { readJsonBody } from "@/lib/guards";
import { AuditService } from "@/lib/services/audit";
import { parsePagination } from "@/lib/query";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("customers:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const where: Prisma.CustomerWhereInput = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search } },
        { phone: { contains: q.search } },
        { email: { contains: q.search } },
        { city: { contains: q.search } },
      ];
    }
    const [items, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          _count: { select: { orders: true } },
        },
      }),
      db.customer.count({ where }),
    ]);

    // attach spending & outstanding via aggregates
    const ids = items.map((i) => i.id);
    const spendAgg = await db.payment.groupBy({ by: ["customerId"], where: { customerId: { in: ids } }, _sum: { amount: true } });
    const orderAgg = await db.order.groupBy({ by: ["customerId"], where: { customerId: { in: ids } }, _sum: { total: true } });
    const spendMap = new Map(spendAgg.map((s) => [s.customerId, toDecimal(s._sum.amount)]));
    const totalMap = new Map(orderAgg.map((s) => [s.customerId, toDecimal(s._sum.total)]));

    return ok({
      items: items.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        city: c.city,
        notes: c.notes,
        externalId: c.externalId,
        createdAt: c.createdAt,
        orderCount: c._count.orders,
        totalSpending: (totalMap.get(c.id) ?? new Prisma.Decimal(0)).toFixed(2),
        outstanding: (totalMap.get(c.id) ?? new Prisma.Decimal(0)).minus(spendMap.get(c.id) ?? new Prisma.Decimal(0)).toFixed(2),
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
    const [user, err] = await requirePermission("customers:create");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const data = parsed.data;

    // Prevent duplicate by phone
    if (data.phone) {
      const existing = await db.customer.findUnique({ where: { phone: data.phone } });
      if (existing) return badRequest("A customer with this phone already exists");
    }
    const customer = await db.customer.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        address: data.address,
        city: data.city,
        notes: data.notes,
        externalId: data.externalId,
      },
    });
    await AuditService.log({ userId: user!.id, action: "CUSTOMER_CREATE", entity: "Customer", entityId: customer.id, changes: data });
    return ok(customer);
  } catch (e) {
    return serverError((e as Error).message);
  }
}
