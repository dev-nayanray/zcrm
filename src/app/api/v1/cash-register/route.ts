import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { CashService } from "@/lib/services/cash";
import { resolveRange } from "@/lib/date-range";
import { parsePagination } from "@/lib/query";
import { z } from "zod";

const closeDaySchema = z.object({
  date: z.string().optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (v) => !v.date || !isNaN(new Date(v.date).getTime()),
  { message: "Invalid date", path: ["date"] },
);

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("reports:read");
    if (err) return err;
    const sp = request.nextUrl.searchParams;
    const action = sp.get("action");
    if (action === "snapshots") {
      const q = parsePagination(sp);
      const res = await CashService.snapshots({ page: q.page, limit: q.limit });
      return ok({ items: res.items, total: res.total });
    }
    const range = resolveRange(sp.get("preset") || undefined, sp.get("from") || undefined, sp.get("to") || undefined);
    return ok(await CashService.summary(range));
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("cash:manage");
    if (err) return err;
    const body = await readJsonBody<{ date?: string; notes?: string }>(request);
    const parsed = closeDaySchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    const date = parsed.data.date ? new Date(parsed.data.date) : new Date();
    if (isNaN(date.getTime())) return badRequest("Invalid date");
    return ok(await CashService.closeDay(date, { closedBy: user.id, notes: parsed.data.notes }));
  } catch (e) { return badRequest((e as Error).message); }
}
