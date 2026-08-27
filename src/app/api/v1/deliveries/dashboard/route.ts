import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { DeliveryService } from "@/lib/services/delivery";

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("deliveries:read");
    if (err) return err;
    return ok(await DeliveryService.dashboard());
  } catch (e) { return serverError((e as Error).message); }
}
