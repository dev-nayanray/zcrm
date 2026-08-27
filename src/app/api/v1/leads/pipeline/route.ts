import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { LeadService } from "@/lib/services/lead";

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("leads:read");
    if (err) return err;
    return ok(await LeadService.pipeline());
  } catch (e) { return serverError((e as Error).message); }
}
