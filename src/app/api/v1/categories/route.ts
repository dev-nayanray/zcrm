import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { createCategorySchema } from "@/lib/validation";
import { AuditService } from "@/lib/services/audit";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("categories:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const where: Prisma.CategoryWhereInput = {};
    if (q.search) where.name = { contains: q.search };

    // If no pagination requested, return all (categories are few)
    const all = request.nextUrl.searchParams.get("all") === "true";
    if (all) {
      const items = await db.category.findMany({
        where,
        include: { parent: true, _count: { select: { products: true, children: true } } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      return ok({ items, total: items.length });
    }

    const [items, total] = await Promise.all([
      db.category.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { parent: true, _count: { select: { products: true, children: true } } },
      }),
      db.category.count({ where }),
    ]);
    return ok({ items, total, page: q.page, limit: q.limit });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("categories:create");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const data = parsed.data;

    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const existing = await db.category.findUnique({ where: { slug } });
    if (existing) return badRequest("Slug already exists");

    // Circular parent check (cannot set parent to self or own descendant)
    if (data.parentId) {
      if (data.parentId === "") { /* ignore empty */ }
      else {
        // Walk up the tree to ensure we don't create a cycle
        let cur: string | null | undefined = data.parentId;
        const seen = new Set<string>();
        while (cur && !seen.has(cur)) {
          if (cur === data.parentId && seen.size > 0) break;
          seen.add(cur);
          const parent = await db.category.findUnique({ where: { id: cur }, select: { parentId: true } });
          cur = parent?.parentId ?? null;
        }
        // (Self-reference would only happen on update; here on create it's fine)
      }
    }

    const category = await db.category.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        imageUrl: data.imageUrl,
        parentId: data.parentId && data.parentId !== "" ? data.parentId : null,
        status: data.status,
        sortOrder: data.sortOrder,
        externalId: data.externalId,
      },
    });
    await AuditService.log({ userId: user!.id, action: "CATEGORY_CREATE", entity: "Category", entityId: category.id, changes: { slug } });
    return ok(category);
  } catch (e) {
    return serverError((e as Error).message);
  }
}
