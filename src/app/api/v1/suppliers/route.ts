import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError, validationError } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { createSupplierSchema } from "@/lib/validation";
import { AuditService } from "@/lib/services/audit";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("suppliers:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const where: Prisma.SupplierWhereInput = {};
    if (q.search) {
      where.OR = [{ name: { contains: q.search } }, { phone: { contains: q.search } }, { company: { contains: q.search } }];
    }
    const [items, total] = await Promise.all([
      db.supplier.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { _count: { select: { purchases: true } } },
      }),
      db.supplier.count({ where }),
    ]);
    // outstanding payable per supplier
    const ids = items.map((i) => i.id);
    const agg = await db.purchase.groupBy({ by: ["supplierId"], where: { supplierId: { in: ids } }, _sum: { dueAmount: true, total: true } });
    const map = new Map(agg.map((a) => [a.supplierId, a]));
    return ok({
      items: items.map((s) => ({
        ...s,
        purchaseCount: s._count.purchases,
        totalPurchases: (map.get(s.id)?._sum.total ?? new Prisma.Decimal(0)).toFixed(2),
        outstanding: (map.get(s.id)?._sum.dueAmount ?? new Prisma.Decimal(0)).toFixed(2),
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
    const [user, err] = await requirePermission("suppliers:create");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = createSupplierSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const supplier = await db.supplier.create({ data: parsed.data });
    await AuditService.log({ userId: user!.id, action: "SUPPLIER_CREATE", entity: "Supplier", entityId: supplier.id, changes: parsed.data });
    return ok(supplier);
  } catch (e) {
    return serverError((e as Error).message);
  }
}
