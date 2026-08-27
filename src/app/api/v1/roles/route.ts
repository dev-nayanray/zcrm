import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { PERMISSIONS } from "@/lib/constants";

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("roles:read");
    if (err) return err;
    const roles = await db.role.findMany({ orderBy: { name: "asc" } });
    const userIds = await Promise.all(roles.map(r => db.user.count({ where: { roleId: r.id } })));
    return ok({
      items: roles.map((r, i) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        permissions: r.permissionActions,
        userCount: userIds[i],
      })),
      allPermissions: PERMISSIONS,
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("roles:create");
    if (err) return err;
    const body = await readJsonBody<{ name: string; description?: string; permissions?: string[] }>(request);
    if (!body?.name) return badRequest("Name required");
    const existing = await db.role.findUnique({ where: { name: body.name } });
    if (existing) return badRequest("Role already exists");
    const created = await db.role.create({
      data: { name: body.name, description: body.description, isSystem: false, permissionActions: body.permissions ?? [] },
    });
    return ok(created);
  } catch (e) {
    return serverError((e as Error).message);
  }
}
