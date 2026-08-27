import { NextRequest } from "next/server";
import { ok, serverError, badRequest, validationError } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { SupplierService } from "@/lib/services/supplier";
import { parsePagination } from "@/lib/query";
import { z } from "zod";

const createSupplierPaymentSchema = z.object({
  supplierId: z.string().min(1, "supplierId required"),
  purchaseId: z.string().min(1).optional(),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => (v === "" || v === null ? "0" : String(v)))
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be greater than zero"),
  method: z.enum(["CASH", "BKASH", "NAGAD", "BANK", "CARD", "WALLET", "OTHER"]),
  transactionReference: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("payments:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const supplierId = request.nextUrl.searchParams.get("supplierId") || undefined;
    const res = await SupplierService.listPayments({ page: q.page, limit: q.limit, supplierId });
    return ok({ items: res.items, total: res.total, page: q.page, limit: q.limit });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest) {
  try {
    // Use the dedicated purchases:pay permission — a SALES user (who has
    // payments:create for customer payments) should NOT be able to pay
    // suppliers, which is a finance/purchasing operation.
    const [, err] = await requirePermission("purchases:pay");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = createSupplierPaymentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    try { return ok(await SupplierService.recordPayment(parsed.data)); }
    catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
