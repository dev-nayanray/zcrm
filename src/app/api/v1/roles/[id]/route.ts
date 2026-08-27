import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, notFound, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { AuditService } from "@/lib/services/audit";
import { PERMISSIONS } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("roles:read");
    if (err) return err;
    const { id } = await ctx.params;
    const role = await db.role.findUnique({ where: { id } });
    if (!role) return notFound("Role not found");
    return ok({
      ...role,
      permissions: role.permissionActions,
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("roles:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<{ name?: string; description?: string; permissions?: string[] }>(request);
    const existing = await db.role.findUnique({ where: { id } });
    if (!existing) return notFound("Role not found");
    if (existing.isSystem && body.permissions) {
      return badRequest("System roles permissions cannot be changed");
    }
    if (body.permissions) {
      const unknown = body.permissions.filter((p) => !(PERMISSIONS as readonly string[]).includes(p));
      if (unknown.length) {
        return badRequest(`Unknown permissions: ${unknown.join(", ")}`);
      }
    }
    const data: Record<string, unknown> = {};
    if (body.name) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.permissions) {
      data.permissionActions = body.permissions;
    }
    const updated = await db.role.update({ where: { id }, data });
    await AuditService.log({ userId: user!.id, action: "PERMISSION_CHANGE", entity: "Role", entityId: id, changes: { permissions: body.permissions } });
    return ok({ ...updated, permissions: updated.permissionActions });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("roles:delete");
    if (err) return err;
    const { id } = await ctx.params;
    const existing = await db.role.findUnique({ where: { id } });
    if (!existing) return notFound("Role not found");
    if (existing.isSystem) {
      return badRequest("System roles cannot be deleted");
    }
    const userCount = await db.user.count({ where: { roleId: id } });
    if (userCount > 0) {
      return badRequest(`Cannot delete role with ${userCount} assigned user(s). Reassign them first.`);
    }
    await db.role.delete({ where: { id } });
    await AuditService.log({ userId: user!.id, action: "ROLE_DELETE", entity: "Role", entityId: id });
    return ok({ success: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
