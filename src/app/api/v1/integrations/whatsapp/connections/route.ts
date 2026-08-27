import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { WhatsAppService } from "@/lib/services/whatsapp";

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("integrations:read");
    if (err) return err;
    const items = await WhatsAppService.listConnections();
    return ok({ items });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("integrations:update");
    if (err) return err;
    const body = await readJsonBody<any>(request);
    if (!body?.name || !body?.phoneNumberId || !body?.accessToken) return badRequest("name, phoneNumberId and accessToken required");
    const res = await WhatsAppService.createConnection(body);
    return ok(res);
  } catch (e) {
    return badRequest((e as Error).message);
  }
}
