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
    return ok({ enabled: false });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
