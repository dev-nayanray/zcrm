import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { WebhookService } from "@/lib/services/webhook";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("webhook_events:retry");
    if (err) return err;
    const { id } = await ctx.params;
    const updated = await WebhookService.retry(id);
    return ok(updated);
  } catch (e) {
    return badRequest((e as Error).message);
  }
}
