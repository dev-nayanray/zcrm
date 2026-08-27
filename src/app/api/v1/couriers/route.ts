import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { CourierService } from "@/lib/services/courier";

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("integrations:read");
    if (err) return err;
    const items = await CourierService.listProviders();
    return ok({ items });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("integrations:update");
    if (err) return err;
    const body = await readJsonBody<any>(request);
    if (!body?.name || !body?.code) return badRequest("name and code required");
    return ok(await CourierService.createProvider(body));
  } catch (e) { return badRequest((e as Error).message); }
}
