import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, validationError, notFound, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { updateProductSchema } from "@/lib/validation";
import { AuditService } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("products:read");
    if (err) return err;
    const { id } = await ctx.params;
    const product = await db.product.findUnique({
      where: { id },
      include: {
        category: true,
        inventory: true,
      },
    });
    if (!product) return notFound("Product not found");

    // Sales history (recent)
    const sales = await db.orderItem.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { order: { select: { orderNumber: true, status: true, createdAt: true } } },
    });
    const purchases = await db.purchaseItem.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { purchase: { select: { purchaseNumber: true, status: true, createdAt: true } } },
    });
    return ok({
      ...product,
      purchasePrice: product.purchasePrice.toFixed(2),
      sellingPrice: product.sellingPrice.toFixed(2),
      wholesalePrice: product.wholesalePrice.toFixed(2),
      minimumStockLevel: product.minimumStockLevel.toFixed(2),
      stock: product.inventory?.quantity?.toFixed(3) ?? "0.000",
      damagedStock: product.inventory?.damagedQuantity?.toFixed(3) ?? "0.000",
      sales,
      purchases,
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("products:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody(request);
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) return notFound("Product not found");

    if (parsed.data.sku && parsed.data.sku !== existing.sku) {
      const conflict = await db.product.findUnique({ where: { sku: parsed.data.sku } });
      if (conflict) return badRequest("SKU already exists");
    }
    const updated = await db.product.update({ where: { id }, data: parsed.data });
    await AuditService.log({ userId: user!.id, action: "PRODUCT_UPDATE", entity: "Product", entityId: id, changes: parsed.data });
    return ok(updated);
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("products:delete");
    if (err) return err;
    const { id } = await ctx.params;
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) return notFound("Product not found");
    // Soft delete: deactivate instead of hard delete to preserve order history
    const updated = await db.product.update({ where: { id }, data: { status: "INACTIVE" } });
    await AuditService.log({ userId: user!.id, action: "PRODUCT_UPDATE", entity: "Product", entityId: id, changes: { status: "INACTIVE" } });
    return ok(updated);
  } catch (e) {
    return serverError((e as Error).message);
  }
}
