import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { TwoFactorService } from "@/lib/services/two-factor";
import { ok, unauthorized, badRequest, serverError, tooManyRequests } from "@/lib/api";
import { readJsonBody, rateLimit, clientIp } from "@/lib/guards";
import { AuditService } from "@/lib/services/audit";

// Completes login after a Telegram 2FA challenge was issued by /auth/login.
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({ key: `2fa-verify:${ip}`, capacity: 10, refillPerSec: 10 / 60 });
    if (!rl.ok) return tooManyRequests(`Too many attempts. Try again in ${rl.retryAfterSec}s.`);

    const body = await readJsonBody<{ challengeToken?: string; code?: string }>(request);
    if (!body?.challengeToken) return badRequest("challengeToken is required");

    const result = await TwoFactorService.verifyLoginChallenge(body.challengeToken, body.code ?? "");
    if (!result.ok) return unauthorized(result.message);

    const user = await db.user.findUnique({ where: { id: result.userId }, include: { role: true } });
    if (!user || !user.isActive) return unauthorized("Invalid account");

    await createSession(user.id);
    await AuditService.log({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id, ipAddress: clientIp(request) });
    void TwoFactorService.notifySecurityEvent(
      user.id,
      `✅ <b>Login verified</b>\nTwo-step verification completed and you're now signed in to Z-CRM.\n📍 IP: <code>${clientIp(request)}</code>`,
    );

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
