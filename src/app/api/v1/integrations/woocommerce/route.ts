import { NextRequest } from "next/server";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { WooCommerceService } from "@/lib/services/woocommerce";
import { updateWooIntegrationSchema } from "@/lib/validation";
import { AuditService } from "@/lib/services/audit";
import { getCurrentUser } from "@/lib/auth";

// GET returns masked config — the consumer secret is NEVER exposed to the client.
export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("integrations:read");
    if (err) return err;
    const cfg = await WooCommerceService.getConfig();
    const integ = await (await import("@/lib/db")).db.integration.findUnique({ where: { name: "woocommerce" } });
    return ok({
      connected: !!cfg && !!cfg.url && !!cfg.consumerKey,
      status: integ?.status ?? "DISCONNECTED",
      lastSyncAt: integ?.lastSyncAt ?? null,
      url: cfg?.url ?? "",
      consumerKey: cfg?.consumerKey ? `${cfg.consumerKey.slice(0, 4)}****${cfg.consumerKey.slice(-4)}` : "",
      webhookSecret: cfg?.webhookSecret ? "****" : "",
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("integrations:update");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = updateWooIntegrationSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    // Only pass fields that were actually provided (non-empty) so the
    // service merges with existing config instead of wiping secrets.
    const update: Record<string, string> = {};
    if (parsed.data.url) update.url = parsed.data.url;
    if (parsed.data.consumerKey) update.consumerKey = parsed.data.consumerKey;
    if (parsed.data.consumerSecret) update.consumerSecret = parsed.data.consumerSecret;
    if (parsed.data.webhookSecret) update.webhookSecret = parsed.data.webhookSecret;
    await WooCommerceService.saveConfig(update);
    await AuditService.log({ userId: user!.id, action: "WOOCOMMERCE_SYNC", entity: "Integration", entityId: "woocommerce", changes: { action: "config_update", fields: Object.keys(update) } });
    return ok({ success: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

// Test connection
export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("integrations:sync");
    if (err) return err;
    const body = await readJsonBody<{ action: string }>(request);
    const user = await getCurrentUser();
    if (body.action === "test") {
      const cfg = await WooCommerceService.getConfig();
      if (!cfg) return badRequest("Not configured");
      const result = await WooCommerceService.testConnection(cfg);
      await WooCommerceService.setStatus(result.ok ? "CONNECTED" : "ERROR");
      return ok(result);
    }
    return ok({ message: "unknown action" });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
