import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, validationError, notFound, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { updateCategorySchema } from "@/lib/validation";
import { AuditService } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("categories:read");
    if (err) return err;
    const { id } = await ctx.params;
    const category = await db.category.findUnique({
      where: { id },
      include: { parent: true, children: true, _count: { select: { products: true } } },
    });
    if (!category) return notFound("Category not found");
    return ok(category);
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("categories:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody(request);
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) return notFound("Category not found");

    // Prevent circular parent: parentId cannot be self or any descendant
    if (parsed.data.parentId && parsed.data.parentId !== "") {
      if (parsed.data.parentId === id) return badRequest("A category cannot be its own parent");
      // walk up from proposed parent to root; if we hit `id`, it's a cycle
      let cur: string | null = parsed.data.parentId;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        if (cur === id) return badRequest("Circular parent relationship detected");
        const p = await db.category.findUnique({ where: { id: cur }, select: { parentId: true } });
        cur = p?.parentId ?? null;
      }
    }

    const updated = await db.category.update({
      where: { id },
      data: {
        ...parsed.data,
        parentId: parsed.data.parentId === "" || parsed.data.parentId === null ? null : parsed.data.parentId,
      },
    });
    await AuditService.log({ userId: user!.id, action: "CATEGORY_UPDATE", entity: "Category", entityId: id, changes: parsed.data });
    return ok(updated);
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("categories:delete");
    if (err) return err;
    const { id } = await ctx.params;
    const existing = await db.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true } } } });
    if (!existing) return notFound("Category not found");
    if (existing._count.products > 0) return badRequest("Cannot delete category with products");
    if (existing._count.children > 0) return badRequest("Cannot delete category with subcategories");
    await db.category.delete({ where: { id } });
    await AuditService.log({ userId: user!.id, action: "CATEGORY_DELETE", entity: "Category", entityId: id });
    return ok({ success: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
