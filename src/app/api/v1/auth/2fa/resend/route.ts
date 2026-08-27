import { NextRequest } from "next/server";
import { TwoFactorService } from "@/lib/services/two-factor";
import { ok, unauthorized, badRequest, serverError, tooManyRequests } from "@/lib/api";
import { readJsonBody, rateLimit, clientIp } from "@/lib/guards";

// Re-sends a fresh Telegram 2FA code for an in-progress login challenge.
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({ key: `2fa-resend:${ip}`, capacity: 5, refillPerSec: 5 / 60 });
    if (!rl.ok) return tooManyRequests(`Too many attempts. Try again in ${rl.retryAfterSec}s.`);

    const body = await readJsonBody<{ challengeToken?: string }>(request);
    if (!body?.challengeToken) return badRequest("challengeToken is required");

    const result = await TwoFactorService.resendLoginChallenge(body.challengeToken);
    if (!result.ok) return unauthorized(result.message);
    return ok({ challengeToken: result.challengeToken });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
