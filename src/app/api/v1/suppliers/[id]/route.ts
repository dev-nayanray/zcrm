import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, validationError, notFound } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { updateSupplierSchema } from "@/lib/validation";
import { AuditService } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("suppliers:read");
    if (err) return err;
    const { id } = await ctx.params;
    const supplier = await db.supplier.findUnique({
      where: { id },
      include: { purchases: { orderBy: { createdAt: "desc" }, take: 50, include: { _count: { select: { items: true } } } } },
    });
    if (!supplier) return notFound("Supplier not found");
    return ok(supplier);
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("suppliers:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody(request);
    const parsed = updateSupplierSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const existing = await db.supplier.findUnique({ where: { id } });
    if (!existing) return notFound("Supplier not found");
    const updated = await db.supplier.update({ where: { id }, data: parsed.data });
    await AuditService.log({ userId: user!.id, action: "SUPPLIER_UPDATE", entity: "Supplier", entityId: id, changes: parsed.data });
    return ok(updated);
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("suppliers:delete");
    if (err) return err;
    const { id } = await ctx.params;
    const existing = await db.supplier.findUnique({ where: { id } });
    if (!existing) return notFound("Supplier not found");
    const purchaseCount = await db.purchase.count({ where: { supplierId: id } });
    if (purchaseCount > 0) return ok({ success: false, message: "Cannot delete supplier with purchases" });
    await db.supplier.delete({ where: { id } });
    await AuditService.log({ userId: user!.id, action: "SUPPLIER_DELETE", entity: "Supplier", entityId: id });
    return ok({ success: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
