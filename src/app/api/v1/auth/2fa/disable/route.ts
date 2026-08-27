import { requireAuth } from "@/lib/guards";
import { ok, serverError } from "@/lib/api";
import { TwoFactorService } from "@/lib/services/two-factor";
import { AuditService } from "@/lib/services/audit";

export async function POST() {
  try {
    const [user, err] = await requireAuth();
    if (err) return err;
    await TwoFactorService.setEnabled(user!.id, false);
    await AuditService.log({ userId: user!.id, action: "2FA_DISABLED", entity: "User", entityId: user!.id });
    void TwoFactorService.notifySecurityEvent(user!.id, "⚠️ <b>Two-step verification disabled</b>\nYour Z-CRM account no longer requires a Telegram code at login. If you didn't do this, re-enable it and change your password immediately.");
    return ok({ enabled: false });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
