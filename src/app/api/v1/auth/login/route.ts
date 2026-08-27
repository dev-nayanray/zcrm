import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession, hashPassword, shouldRehash } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { ok, unauthorized, validationError, serverError, tooManyRequests } from "@/lib/api";
import { readJsonBody, rateLimit, clientIp } from "@/lib/guards";
import { AuditService } from "@/lib/services/audit";

// A fixed decoy password hash used to equalize the timing of the
// "user-not-found" path with the "wrong-password" path. Without this, a
// missing user returns ~instantly while a real-user wrong-password attempt
// takes ~100ms (PBKDF2), which lets an attacker enumerate valid emails.
// Uses MIN_ITER (100k) iteration count to match the typical stored-hash
// iteration count, so timing is similar for both branches.
const DECOY_HASH =
  "pbkdf2$100000$" +
  "00000000000000000000000000000000$" +
  "0000000000000000000000000000000000000000000000000000000000000000";

export async function POST(request: NextRequest) {
  try {
    // Rate-limit: 10 attempts per minute per IP. Mitigates brute-force and
    // credential-stuffing attacks against the login endpoint.
    const ip = clientIp(request);
    const rl = rateLimit({ key: `login:${ip}`, capacity: 10, refillPerSec: 10 / 60 });
    if (!rl.ok) {
      return tooManyRequests(`Too many login attempts. Try again in ${rl.retryAfterSec}s.`);
    }

    const body = await readJsonBody(request);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const { email, password } = parsed.data;

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      // Run a dummy PBKDF2 verification against the decoy hash to equalize
      // timing. This makes the "user not found" path take the same ~100ms
      // as a real-user wrong-password attempt.
      await verifyPassword(password, DECOY_HASH);
      return unauthorized("Invalid email or password");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return unauthorized("Invalid email or password");

    // Rehash the password if the stored hash uses an old iteration count.
    // Transparent to the user — they log in successfully and the stored
    // hash is upgraded in place.
    let updatedExtra: { passwordHash?: string } = {};
    if (shouldRehash(user.passwordHash)) {
      updatedExtra.passwordHash = await hashPassword(password);
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), ...updatedExtra },
    });
    await createSession(user.id);
    await AuditService.log({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id });

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
