import { requireAuth } from "@/lib/guards";
import { ok, serverError } from "@/lib/api";
import { TwoFactorService } from "@/lib/services/two-factor";

// Generates a short-lived code the user sends to the bot via "/link CODE"
// in a private Telegram chat, linking their Telegram identity to this CRM
// account so it can receive 2FA codes.
export async function POST() {
  try {
    const [user, err] = await requireAuth();
    if (err) return err;
    const result = await TwoFactorService.generateLinkCode(user!.id);
    return ok(result);
  } catch (e) {
    return serverError((e as Error).message);
  }
}
