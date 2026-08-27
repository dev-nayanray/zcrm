import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { createReturnSchema } from "@/lib/validation";
import { ReturnService } from "@/lib/services/return";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("returns:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const orderId = request.nextUrl.searchParams.get("orderId") || undefined;
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const where: Prisma.ReturnWhereInput = {};
    if (orderId) where.orderId = orderId;
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      db.return.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          order: { select: { id: true, orderNumber: true } },
          customer: { select: { id: true, name: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
          creator: { select: { id: true, name: true } },
        },
      }),
      db.return.count({ where }),
    ]);
    return ok({
      items: items.map((r) => ({
        ...r,
        refundAmount: r.refundAmount.toFixed(2),
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
    const [, err] = await requirePermission("returns:create");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = createReturnSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    try {
      const ret = await ReturnService.create(parsed.data);
      return ok(ret);
    } catch (e) {
      return badRequest((e as Error).message);
    }
  } catch (e) {
    return serverError((e as Error).message);
  }
}
