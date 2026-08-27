import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { CashService } from "@/lib/services/cash";
import { resolveRange } from "@/lib/date-range";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("reports:read");
    if (err) return err;
    const sp = request.nextUrl.searchParams;
    const range = resolveRange(sp.get("preset") || undefined, sp.get("from") || undefined, sp.get("to") || undefined);
    return ok(await CashService.summary(range));
  } catch (e) { return serverError((e as Error).message); }
}
