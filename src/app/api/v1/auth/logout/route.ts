import { NextRequest } from "next/server";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/api";
import { AuditService } from "@/lib/services/audit";
import { TwoFactorService } from "@/lib/services/two-factor";
import { clientIp } from "@/lib/guards";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (user) {
      const ip = clientIp(request);
      await AuditService.log({ userId: user.id, action: "LOGOUT", entity: "User", entityId: user.id, ipAddress: ip });
      void TwoFactorService.notifySecurityEvent(user.id, `👋 <b>Signed out of Z-CRM</b>\n📍 IP: <code>${ip}</code>`);
    }
    await destroySession();
    return ok({ success: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
