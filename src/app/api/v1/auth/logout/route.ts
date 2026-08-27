import { NextRequest } from "next/server";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/api";
import { AuditService } from "@/lib/services/audit";

export async function POST(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (user) {
      await AuditService.log({ userId: user.id, action: "LOGOUT", entity: "User", entityId: user.id });
    }
    await destroySession();
    return ok({ success: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
