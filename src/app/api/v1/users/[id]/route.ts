import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError, validationError, notFound, badRequest, forbidden } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { updateUserSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { AuditService } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

// System roles cannot be deleted or stripped of their SUPER_ADMIN user
// (would lock the system out). Validate role-change operations against
// this list.
const SYSTEM_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES", "INVENTORY", "ACCOUNTANT"];

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("users:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody(request);
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const existing = await db.user.findUnique({ where: { id }, include: { role: true } });
    if (!existing) return notFound("User not found");

    const data: Record<string, unknown> = {};
    if (parsed.data.name) data.name = parsed.data.name;
    if (parsed.data.email) data.email = parsed.data.email.toLowerCase();
    if (parsed.data.phone !== undefined) data.phone = parsed.data.phone;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    if (parsed.data.password) data.passwordHash = await hashPassword(parsed.data.password);
    let newRoleName = existing.role.name;
    if (parsed.data.roleName) {
      const role = await db.role.findUnique({ where: { name: parsed.data.roleName } });
      if (!role) return badRequest("Invalid role");
      // SECURITY: only SUPER_ADMIN can promote to SUPER_ADMIN. ADMIN can
      // manage other roles but cannot create peers or superiors.
      if (parsed.data.roleName === "SUPER_ADMIN" && user!.role.name !== "SUPER_ADMIN") {
        return forbidden("Only a SUPER_ADMIN can assign the SUPER_ADMIN role");
      }
      data.roleId = role.id;
      newRoleName = parsed.data.roleName;
    }

    // SECURITY: last-super-admin guard. If the change would demote or
    // deactivate the only remaining SUPER_ADMIN, refuse — otherwise an
    // admin could accidentally lock the system out.
    if (existing.role.name === "SUPER_ADMIN" && (newRoleName !== "SUPER_ADMIN" || parsed.data.isActive === false)) {
      const superAdminCount = await db.user.count({
        where: { role: { name: "SUPER_ADMIN" }, isActive: true },
      });
      if (superAdminCount <= 1) {
        return badRequest("Cannot demote or deactivate the last SUPER_ADMIN. Promote another user first.");
      }
    }

    const updated = await db.user.update({ where: { id }, data, include: { role: true } });

    // SECURITY: do NOT log the cleartext password to the audit log. The
    // previous implementation spread `parsed.data` directly, which
    // included the `password` field in plain text in the audit log —
    // readable by any audit_logs:read user. We sanitize the changes to
    // record that a password change happened, without the value.
    const auditChanges: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.password) {
      auditChanges.password = "[REDACTED]";
    }

    await AuditService.log({ userId: user!.id, action: "USER_UPDATE", entity: "User", entityId: id, changes: auditChanges });
    return ok({ id: updated.id, name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("users:delete");
    if (err) return err;
    const { id } = await ctx.params;
    const existing = await db.user.findUnique({ where: { id }, include: { role: true } });
    if (!existing) return notFound("User not found");
    if (existing.id === user!.id) return badRequest("Cannot delete your own account");

    // Last-super-admin guard for delete (soft-delete via isActive=false).
    if (existing.role.name === "SUPER_ADMIN") {
      const superAdminCount = await db.user.count({
        where: { role: { name: "SUPER_ADMIN" }, isActive: true },
      });
      if (superAdminCount <= 1) {
        return badRequest("Cannot delete the last SUPER_ADMIN. Promote another user first.");
      }
    }

    // Deactivate instead of hard delete to preserve audit logs.
    const updated = await db.user.update({ where: { id }, data: { isActive: false } });
    await AuditService.log({ userId: user!.id, action: "USER_UPDATE", entity: "User", entityId: id, changes: { deactivated: true } });
    return ok({ success: true, id: updated.id });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

void Prisma;
void SYSTEM_ROLES;
