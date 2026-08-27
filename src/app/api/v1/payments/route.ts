import { NextRequest } from "next/server";
import { ok, serverError, validationError, badRequest, notFound } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { PaymentService } from "@/lib/services/payment";
import { parsePagination } from "@/lib/query";

// /payments — list Payment records (customer money in).
// POSTs to this endpoint are NOT accepted — the canonical refund endpoint
// is /api/v1/refunds (POST). The previous implementation of this route's
// POST created a REFUND via RefundService under the misleading /payments
// path, which confused callers (a POST to /payments got a refund created,
// not a payment). To create a customer payment, POST to
// /api/v1/orders/[id]/payments. To create a refund, POST to /api/v1/refunds.
export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("payments:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const method = request.nextUrl.searchParams.get("method") || undefined;
    const orderId = request.nextUrl.searchParams.get("orderId") || undefined;
    const customerId = request.nextUrl.searchParams.get("customerId") || undefined;
    const from = request.nextUrl.searchParams.get("from") || undefined;
    const to = request.nextUrl.searchParams.get("to") || undefined;
    const items = await PaymentService.list({
      page: q.page, limit: q.limit, search: q.search, method, orderId, customerId,
      from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined,
    });
    return ok({
      items: items.items.map((p) => ({
        ...p,
        amount: p.amount.toFixed(2),
      })),
      total: items.total,
      page: q.page,
      limit: q.limit,
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

// POST /payments is intentionally NOT implemented. Use:
//   POST /api/v1/orders/[id]/payments — record a customer payment
//   POST /api/v1/refunds               — issue a refund
export async function POST() {
  return badRequest("POST /api/v1/payments is not supported. To record a payment, POST to /api/v1/orders/{id}/payments. To issue a refund, POST to /api/v1/refunds.");
}

void validationError;
void notFound;
void readJsonBody;
