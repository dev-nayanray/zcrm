import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError, validationError, badRequest, forbidden } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { createUserSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { AuditService } from "@/lib/services/audit";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("users:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const where: Prisma.UserWhereInput = {};
    if (q.search) {
      where.OR = [{ name: { contains: q.search } }, { email: { contains: q.search } }];
    }
    const [items, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { role: true },
      }),
      db.user.count({ where }),
    ]);
    return ok({
      items: items.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: { id: u.role.id, name: u.role.name },
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
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
    const [user, err] = await requirePermission("users:create");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const data = parsed.data;
    // SECURITY: only SUPER_ADMIN can create another SUPER_ADMIN. ADMIN can
    // create every other role but cannot create peers or superiors.
    if (data.roleName === "SUPER_ADMIN" && user!.role.name !== "SUPER_ADMIN") {
      return forbidden("Only a SUPER_ADMIN can create SUPER_ADMIN users");
    }
    const existing = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) return badRequest("Email already in use");
    const role = await db.role.findUnique({ where: { name: data.roleName } });
    if (!role) return badRequest("Invalid role");
    const passwordHash = await hashPassword(data.password);
    const created = await db.user.create({
      data: { name: data.name, email: data.email.toLowerCase(), phone: data.phone, passwordHash, roleId: role.id, isActive: data.isActive },
      include: { role: true },
    });
    await AuditService.log({ userId: user!.id, action: "USER_CREATE", entity: "User", entityId: created.id, changes: { email: data.email, role: data.roleName } });
    return ok({ id: created.id, name: created.name, email: created.email, role: created.role });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
