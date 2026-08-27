import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, validationError } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { updateSettingsSchema } from "@/lib/validation";
import { AuditService } from "@/lib/services/audit";

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("settings:read");
    if (err) return err;
    const items = await db.setting.findMany();
    const settings: Record<string, string> = {};
    for (const s of items) settings[s.key] = s.value;
    return ok({ settings });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("settings:update");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const entries = Object.entries(parsed.data.settings) as [string, string][];
    for (const [key, value] of entries) {
      await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    }
    await AuditService.log({ userId: user!.id, action: "SETTINGS_UPDATE", entity: "Setting", entityId: "settings", changes: parsed.data.settings });
    return ok({ success: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
