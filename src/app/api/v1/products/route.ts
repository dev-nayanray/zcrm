import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { createProductSchema } from "@/lib/validation";
import { AuditService } from "@/lib/services/audit";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("products:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const categoryId = request.nextUrl.searchParams.get("categoryId") || undefined;
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const where: Prisma.ProductWhereInput = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search } },
        { sku: { contains: q.search } },
        { brand: { contains: q.search } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { category: true, inventory: true },
      }),
      db.product.count({ where }),
    ]);
    return ok({
      items: items.map((p) => ({
        ...p,
        purchasePrice: p.purchasePrice.toFixed(2),
        sellingPrice: p.sellingPrice.toFixed(2),
        wholesalePrice: p.wholesalePrice.toFixed(2),
        minimumStockLevel: p.minimumStockLevel.toFixed(2),
        stock: p.inventory?.quantity?.toFixed(3) ?? "0.000",
        damagedStock: p.inventory?.damagedQuantity?.toFixed(3) ?? "0.000",
      })),
      total,
      page: q.page,
      limit: q.limit,
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("products:create");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const data = parsed.data;

    const existingSku = await db.product.findUnique({ where: { sku: data.sku } });
    if (existingSku) return badRequest("SKU already exists");

    const slug = data.slug || data.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const existingSlug = await db.product.findUnique({ where: { slug } });
    if (existingSlug) return badRequest("Slug already exists");

    const product = await db.product.create({
      data: {
        sku: data.sku,
        name: data.name,
        slug,
        description: data.description,
        categoryId: data.categoryId,
        brand: data.brand,
        purchasePrice: data.purchasePrice,
        sellingPrice: data.sellingPrice,
        wholesalePrice: data.wholesalePrice,
        minimumStockLevel: data.minimumStockLevel,
        imageUrl: data.imageUrl,
        status: data.status,
        externalId: data.externalId,
      },
    });
    // create empty inventory row
    await db.inventory.create({ data: { productId: product.id } });
    await AuditService.log({ userId: user!.id, action: "PRODUCT_CREATE", entity: "Product", entityId: product.id, changes: { sku: data.sku } });
    return ok(product);
  } catch (e) {
    return serverError((e as Error).message);
  }
}
