import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { AccountingService } from "@/lib/services/accounting";
import { resolveRange } from "@/lib/date-range";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("reports:read");
    if (err) return err;
    const sp = request.nextUrl.searchParams;
    const range = resolveRange(sp.get("preset") || undefined, sp.get("from") || undefined, sp.get("to") || undefined);
    const topProducts = await AccountingService.topProducts(range, 100);
    return ok({
      items: topProducts,
      range: { from: range.from?.toISOString(), to: range.to?.toISOString() },
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
