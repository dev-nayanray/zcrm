import { requireAuth } from "@/lib/guards";
import { ok, badRequest } from "@/lib/api";
import { TwoFactorService } from "@/lib/services/two-factor";
import { AuditService } from "@/lib/services/audit";

export async function POST() {
  try {
    const [user, err] = await requireAuth();
    if (err) return err;
    await TwoFactorService.setEnabled(user!.id, true);
    await AuditService.log({ userId: user!.id, action: "2FA_ENABLED", entity: "User", entityId: user!.id });
    void TwoFactorService.notifySecurityEvent(user!.id, "🛡️ <b>Two-step verification enabled</b>\nYour Z-CRM account now requires a Telegram code (or tap-to-approve) at every login.");
    return ok({ enabled: true });
  } catch (e) {
    return badRequest((e as Error).message);
  }
}
