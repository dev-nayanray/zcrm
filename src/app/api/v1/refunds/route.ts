import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, validationError, badRequest, notFound } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { parsePagination } from "@/lib/query";
import { createRefundSchema } from "@/lib/validation";
import { RefundService } from "@/lib/services/return";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("refunds:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const orderId = request.nextUrl.searchParams.get("orderId") || undefined;
    const where: Record<string, unknown> = {};
    if (orderId) where.orderId = orderId;
    const [items, total] = await Promise.all([
      db.refund.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          order: { select: { id: true, orderNumber: true } },
          creator: { select: { id: true, name: true } },
        },
      }),
      db.refund.count({ where }),
    ]);
    return ok({
      items: items.map((r) => ({ ...r, amount: r.amount.toFixed(2) })),
      total,
      page: q.page,
      limit: q.limit,
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

// POST — create a standalone refund (not tied to a return). The body is
// the createRefundSchema plus orderId. RefundService validates amount ≤
// order.paidAmount and writes an audit log inside the transaction.
export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("refunds:create");
    if (err) return err;
    const body = await readJsonBody<{ orderId?: string } & Record<string, unknown>>(request);
    const parsed = createRefundSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    if (!body?.orderId) return badRequest("orderId is required to create a refund");
    // Verify the order exists for a clean 404.
    const order = await db.order.findUnique({ where: { id: body.orderId } });
    if (!order) return notFound("Order not found");
    try {
      const refund = await RefundService.create({
        orderId: body.orderId,
        amount: parsed.data.amount,
        method: parsed.data.method,
        paymentId: parsed.data.paymentId ?? null,
        returnId: parsed.data.returnId ?? null,
        transactionReference: parsed.data.transactionReference,
        notes: parsed.data.notes,
      });
      return ok(refund);
    } catch (e) {
      return badRequest((e as Error).message);
    }
  } catch (e) {
    return serverError((e as Error).message);
  }
}
