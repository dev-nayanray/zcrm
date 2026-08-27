import { NextRequest } from "next/server";
import { TwoFactorService } from "@/lib/services/two-factor";
import { ok, badRequest, serverError, tooManyRequests } from "@/lib/api";
import { readJsonBody, rateLimit, clientIp } from "@/lib/guards";

// Lets the login screen poll whether the user has tapped Approve/Deny on
// the Telegram 2FA DM, as an alternative to typing the 6-digit code.
// Never creates a session itself — the client still calls /2fa/verify
// (with no code) once this reports APPROVED, so session creation and
// audit logging stay in one place.
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({ key: `2fa-poll:${ip}`, capacity: 60, refillPerSec: 1 });
    if (!rl.ok) return tooManyRequests(`Too many requests. Try again in ${rl.retryAfterSec}s.`);

    const body = await readJsonBody<{ challengeToken?: string }>(request);
    if (!body?.challengeToken) return badRequest("challengeToken is required");

    const result = await TwoFactorService.pollChallenge(body.challengeToken);
    return ok(result);
  } catch (e) {
    return serverError((e as Error).message);
  }
}
