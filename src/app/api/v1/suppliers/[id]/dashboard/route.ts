import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { SupplierService } from "@/lib/services/supplier";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("suppliers:read");
    if (err) return err;
    const { id } = await ctx.params;
    const dash = await SupplierService.dashboard(id);
    return ok({ ...dash, totalPurchases: dash.totalPurchases, totalPaid: dash.totalPaid, outstandingPayable: dash.outstandingPayable, supplierPayments: dash.supplierPayments });
  } catch (e) { return serverError((e as Error).message); }
}
