import { NextRequest } from "next/server";
import { getCurrentUser, verifyPassword, hashPassword, shouldRehash } from "@/lib/auth";
import { ok, unauthorized, badRequest, validationError, serverError } from "@/lib/api";
import { resolveRolePermissions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(_request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return ok({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: { id: user.role.id, name: user.role.name },
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
    permissions: resolveRolePermissions(user.role.name as never),
  });
}

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name too short").max(120).optional(),
  phone: z.string().min(6, "Phone too short").max(32).optional(),
  // Password change requires the current password to mitigate session
  // hijack → account takeover (a stolen cookie alone cannot change the
  // password without knowing the current one).
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
}).refine(
  (v) => !v.newPassword || (v.currentPassword && v.currentPassword.length > 0),
  { message: "Current password is required to change password", path: ["currentPassword"] },
);

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const body = await request.json().catch(() => null);
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const data: { name?: string; phone?: string; passwordHash?: string } = {};
    if (parsed.data.name) data.name = parsed.data.name;
    if (parsed.data.phone !== undefined) data.phone = parsed.data.phone;

    // Password change: verify current password before accepting the new one.
    if (parsed.data.newPassword) {
      const valid = await verifyPassword(parsed.data.currentPassword!, user.passwordHash);
      if (!valid) return badRequest("Current password is incorrect");
      data.passwordHash = await hashPassword(parsed.data.newPassword);
    } else if (shouldRehash(user.passwordHash)) {
      // No password change requested, but stored hash uses an old iteration
      // count — leave as-is for now; the next password change will rehash.
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data,
      include: { role: true },
    });

    return ok({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: { id: updated.role.id, name: updated.role.name },
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
