import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { AutomationService } from "@/lib/services/automation";

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("automation:read");
    if (err) return err;
    const items = await AutomationService.listRules();
    return ok({ items });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("automation:update");
    if (err) return err;
    const body = await readJsonBody<any>(request);
    if (!body?.name || !body?.event || !body?.action) return badRequest("name, event and action required");
    try { return ok(await AutomationService.createRule(body)); }
    catch (e) { return badRequest((e as Error).message); }
  } catch (e) { return serverError((e as Error).message); }
}
