import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { InventoryService } from "@/lib/services/inventory";
import { AuditService } from "@/lib/services/audit";
import { toDecimal } from "@/lib/decimal";
import { parsePagination } from "@/lib/query";

const purchaseReturnItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z
    .union([z.string(), z.number()])
    .transform((v) => (v === "" || v === null ? "0" : String(v)))
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Quantity must be > 0"),
});

const purchaseReturnSchema = z.object({
  purchaseId: z.string().min(1, "purchaseId required"),
  reason: z.string().max(500).optional(),
  items: z.array(purchaseReturnItemSchema).min(1, "At least one item required"),
});

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("purchases:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const [items, total] = await Promise.all([
      db.purchaseReturn.findMany({ where: {}, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.limit, take: q.limit, include: { purchase: { select: { purchaseNumber: true, supplier: { select: { name: true } } } }, _count: { select: { items: true } } } }),
      db.purchaseReturn.count(),
    ]);
    return ok({ items: items.map((p) => ({ ...p, total: p.total.toFixed(2) })), total, page: q.page, limit: q.limit });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("purchases:update");
    if (err) return err;
    const body = await readJsonBody<{ purchaseId: string; reason?: string; items: { productId: string; quantity: string | number }[] }>(request);
    const parsed = purchaseReturnSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    return db.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({ where: { id: parsed.data.purchaseId }, include: { items: true } });
      if (!purchase) throw new Error("Purchase not found");
      // Reject returns against PENDING or CANCELLED purchases — goods
      // were never received, so there's nothing to return to the supplier.
      if (purchase.status !== "RECEIVED") {
        throw new Error(`Cannot return items for a purchase with status ${purchase.status}. Purchase must be RECEIVED.`);
      }
      const count = await tx.purchaseReturn.count();
      const returnNumber = `PR-${String(count + 1001).padStart(6, "0")}`;
      let total = new Prisma.Decimal(0);
      const lineItems = parsed.data.items.map((it) => {
        const pi = purchase.items.find((x) => x.productId === it.productId);
        if (!pi) {
          throw new Error(`Product ${it.productId} is not part of purchase ${purchase.purchaseNumber}`);
        }
        const unitCost = pi.unitCost;
        const qty = toDecimal(it.quantity);
        if (qty.gt(pi.quantity)) {
          throw new Error(`Return quantity ${qty.toFixed(0)} exceeds purchased quantity ${pi.quantity.toFixed(0)} for product`);
        }
        const lineTotal = qty.times(unitCost);
        total = total.plus(lineTotal);
        return { productId: it.productId, quantity: qty, unitCost, total: lineTotal };
      });
      const ret = await tx.purchaseReturn.create({
        data: { returnNumber, purchaseId: purchase.id, status: "COMPLETED", total, reason: parsed.data.reason, createdBy: user?.id, items: { create: lineItems } },
        include: { items: true },
      });
      // Return stock to supplier = reduce inventory (TRANSFER_OUT for
      // traceability) AND reduce the purchase's dueAmount by the return
      // total — the supplier now owes the customer for the returned goods.
      for (const li of lineItems) {
        await InventoryService.applyMovementInTx(tx, {
          productId: li.productId,
          type: "TRANSFER_OUT",
          quantityChange: li.quantity.negated(),
          referenceType: "PURCHASE_RETURN",
          referenceId: ret.id,
          reason: `Purchase return ${returnNumber}`,
          createdBy: user?.id,
        });
      }
      // Reduce the purchase's dueAmount by the return total — the
      // supplier now owes a credit for the returned goods. If the
      // purchase was already fully paid, this creates a positive credit
      // balance that can be applied to future purchases from the same
      // supplier.
      const newDue = toDecimal(purchase.dueAmount).minus(total);
      const clampedDue = newDue.lt(0) ? new Prisma.Decimal(0) : newDue;
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { dueAmount: clampedDue },
      });
      await AuditService.log(
        {
          userId: user?.id,
          action: "PURCHASE_RETURN",
          entity: "PurchaseReturn",
          entityId: ret.id,
          changes: { returnNumber, total: total.toFixed(2), purchaseDueAdjusted: total.toFixed(2) },
        },
        tx,
      );
      return ok({ ...ret, total: ret.total.toFixed(2) });
    }, { timeout: 20000, maxWait: 10000 });
  } catch (e) { return badRequest((e as Error).message); }
}
