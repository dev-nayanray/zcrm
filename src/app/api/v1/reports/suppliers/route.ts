import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { resolveRange } from "@/lib/date-range";
import { toDecimal } from "@/lib/decimal";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("reports:read");
    if (err) return err;
    const sp = request.nextUrl.searchParams;
    const range = resolveRange(sp.get("preset") || undefined, sp.get("from") || undefined, sp.get("to") || undefined);
    const rangeCreated: Record<string, Date> = {};
    if (range.from) rangeCreated.gte = range.from;
    if (range.to) rangeCreated.lte = range.to;
    const suppliers = await db.supplier.findMany({ include: { purchases: { where: Object.keys(rangeCreated).length ? { createdAt: rangeCreated } : {} } } });
    const items = suppliers.map((s) => {
      const totalPurchases = s.purchases.reduce((sum, p) => sum.add(p.total), new Prisma.Decimal(0));
      const totalPaid = s.purchases.reduce((sum, p) => sum.add(p.paidAmount), new Prisma.Decimal(0));
      const totalDue = s.purchases.reduce((sum, p) => sum.add(p.dueAmount), new Prisma.Decimal(0));
      return { id: s.id, name: s.name, company: s.company, phone: s.phone, purchaseCount: s.purchases.length, totalPurchases: totalPurchases.toFixed(2), totalPaid: totalPaid.toFixed(2), totalDue: totalDue.toFixed(2) };
    }).filter((s) => s.purchaseCount > 0 || Number(s.totalDue) > 0);
    return ok({ items, range: { from: range.from?.toISOString(), to: range.to?.toISOString() } });
  } catch (e) { return serverError((e as Error).message); }
}
