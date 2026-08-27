import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { SalesPipelineService } from "@/lib/services/sales-pipeline";

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("pipelines:read");
    if (err) return err;
    return ok(await SalesPipelineService.pipeline());
  } catch (e) { return serverError((e as Error).message); }
}
