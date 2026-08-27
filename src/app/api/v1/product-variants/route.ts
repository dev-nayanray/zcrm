import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("products:read");
    if (err) return err;
    const productId = request.nextUrl.searchParams.get("productId");
    const items = await db.productVariant.findMany({ where: productId ? { productId } : undefined, include: { product: { select: { name: true, sku: true } } } });
    return ok({ items: items.map((v) => ({ ...v, purchasePrice: v.purchasePrice.toFixed(2), sellingPrice: v.sellingPrice.toFixed(2) })) });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("products:create");
    if (err) return err;
    const body = await readJsonBody<any>(request);
    if (!body?.productId || !body?.sku || !body?.name) return badRequest("productId, sku and name required");
    const existing = await db.productVariant.findUnique({ where: { sku: body.sku } });
    if (existing) return badRequest("Variant SKU already exists");
    return ok(await db.productVariant.create({ data: { ...body } }));
  } catch (e) { return badRequest((e as Error).message); }
}
