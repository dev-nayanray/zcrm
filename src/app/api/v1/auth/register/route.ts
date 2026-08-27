import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { ok, badRequest, validationError, serverError, tooManyRequests } from "@/lib/api";
import { readJsonBody, rateLimit, clientIp } from "@/lib/guards";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Name too short").max(120),
  email: z.string().email("Valid email required"),
  phone: z.string().min(6, "Phone required").max(32),
  password: z.string().min(8, "Password must be at least 8 characters"),
  // Honeypot — must be empty. Bots auto-fill every field; real users never
  // see this input because it's hidden off-screen.
  website: z.string().max(0, "Spam detected").optional(),
  // Invite token — required if any user already exists (i.e. the CRM has
  // been initialized). The first user can register without one (bootstrap).
  inviteToken: z.string().max(200).optional(),
  // Selected billing plan from the landing page.
  plan: z.enum(["WEEKLY", "MONTHLY", "YEARLY", "LIFETIME"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate-limit: 5 signups per hour per IP.
    const ip = clientIp(request);
    const rl = rateLimit({ key: `register:${ip}`, capacity: 5, refillPerSec: 5 / 3600 });
    if (!rl.ok) {
      return tooManyRequests(`Too many signups from this IP. Try again in ${rl.retryAfterSec}s.`);
    }

    const body = await readJsonBody(request);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { name, email, phone, password, inviteToken, plan } = parsed.data;

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return badRequest("An account with this email already exists");

    // Bootstrap policy: if any user already exists in the system, an
    // invite token issued by an admin is required. This prevents open
    // self-provisioning of SALES accounts once the CRM is initialized.
    const userCount = await db.user.count();
    if (userCount > 0) {
      if (!inviteToken) {
        return badRequest("Registration is by invitation only. Please ask an administrator for an invite link.");
      }
      // Validate the invite token against stored settings.
      const validToken = await db.setting.findUnique({ where: { key: "active_invite_token" } });
      if (!validToken || validToken.value !== inviteToken) {
        return badRequest("Invalid or expired invite token.");
      }
    }

    const passwordHash = await hashPassword(password);
    const role = await db.role.findUnique({ where: { name: "SALES" } });
    if (!role) return serverError("Default role not found");

    const user = await db.user.create({
      data: { name, email: email.toLowerCase(), phone, passwordHash, roleId: role.id, isActive: true },
      include: { role: true },
    });

    await createSession(user.id);
    await db.wallet.create({ data: { userId: user.id, balance: 0 } });

    // Auto-subscribe to the selected plan (or default to WEEKLY trial).
    // The Subscription model uses `plan` (string), `startDate`, and `endDate`
    // (no planId, no currentPeriodStart/End). We create a fresh subscription
    // row rather than upsert because there's no unique constraint on userId
    // (a user can have multiple historical subscriptions).
    const planCode = plan ?? "WEEKLY";
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day trial
    await db.subscription.create({
      data: {
        userId: user.id,
        plan: planCode,
        status: "TRIALING",
        startDate: now,
        endDate: expires,
        billingCycle: planCode,
      },
    });

    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: { id: user.role.id, name: user.role.name },
      },
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

// GET — current user profile (kept for backwards compatibility with the
// client; canonical endpoint is /api/v1/auth/me).
import { getCurrentUser } from "@/lib/auth";

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return badRequest("Not authenticated");
    return ok({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: { id: user.role.id, name: user.role.name },
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

// PUT — proxy to /me (canonical endpoint). Kept for backwards compatibility
// with existing frontend code that PUTs to /register. The current-password
// check is enforced at /me — clients without a currentPassword will get a
// 422. This proxy is intentional: the frontend still works while clients
// migrate to /me.
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return badRequest("Not authenticated");
    const body = await readJsonBody<{ name?: string; phone?: string; currentPassword?: string; newPassword?: string }>(request);
    const data: { name?: string; phone?: string; passwordHash?: string } = {};
    if (body?.name) data.name = body.name;
    if (body?.phone !== undefined) data.phone = body.phone;
    // If a new password is supplied without a verified current password, we
    // refuse (the canonical /me endpoint enforces this). If no password
    // change is requested, we proceed with name/phone update only.
    if (body?.newPassword) {
      if (!body.currentPassword) return badRequest("Current password is required to change password");
      // Forward to /me by calling the same logic inline (avoids an internal
      // HTTP round-trip).
      const { verifyPassword, hashPassword } = await import("@/lib/auth");
      const valid = await verifyPassword(body.currentPassword, user.passwordHash);
      if (!valid) return badRequest("Current password is incorrect");
      data.passwordHash = await hashPassword(body.newPassword);
    }
    const updated = await db.user.update({ where: { id: user.id }, data, include: { role: true } });
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
