import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { createPurchaseSchema } from "@/lib/validation";
import { PurchaseService } from "@/lib/services/purchase";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("purchases:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const supplierId = request.nextUrl.searchParams.get("supplierId") || undefined;
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const where: Prisma.PurchaseWhereInput = {};
    if (q.search) where.purchaseNumber = { contains: q.search };
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      db.purchase.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          supplier: { select: { id: true, name: true, company: true } },
          _count: { select: { items: true } },
          creator: { select: { id: true, name: true } },
        },
      }),
      db.purchase.count({ where }),
    ]);
    return ok({
      items: items.map((p) => ({
        ...p,
        subtotal: p.subtotal.toFixed(2),
        discount: p.discount.toFixed(2),
        shippingCost: p.shippingCost.toFixed(2),
        total: p.total.toFixed(2),
        paidAmount: p.paidAmount.toFixed(2),
        dueAmount: p.dueAmount.toFixed(2),
        itemCount: p._count.items,
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
    const [, err] = await requirePermission("purchases:create");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = createPurchaseSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    try {
      const purchase = await PurchaseService.create(parsed.data);
      return ok(purchase);
    } catch (e) {
      return badRequest((e as Error).message);
    }
  } catch (e) {
    return serverError((e as Error).message);
  }
}
