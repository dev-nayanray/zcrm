import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";

// WebhookService — idempotent webhook event processing for ALL providers
// (Meta, WhatsApp, WooCommerce). The unique constraint on (provider, eventId)
// guarantees we never process the same event twice.
//
// Flow:
//   1. recordEvent(provider, eventId, type, payload) → upserts a WebhookEvent
//      row keyed on (provider, eventId). If the event already exists with
//      status=SUCCESS, we return "duplicate" and the handler skips.
//   2. The handler runs the business logic.
//   3. markSuccess / markFailed updates the row.
//
// Retry: failed events can be retried by an admin (POST /webhook-events/:id/retry).

function hashPayload(payload: unknown): string {
  try {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  } catch {
    return "";
  }
}

export const WebhookService = {
  /**
   * Record (or look up) a webhook event. Returns { isDuplicate, event }.
   * If the event was already successfully processed, isDuplicate=true so the
   * caller can skip re-processing.
   */
  async recordEvent(opts: { provider: string; eventId: string; eventType?: string; payload?: unknown }) {
    const payloadStr = opts.payload ? JSON.stringify(opts.payload) : null;
    const payloadHash = opts.payload ? hashPayload(opts.payload) : null;
    // Upsert: if the (provider, eventId) already exists, keep existing status
    const existing = await db.webhookEvent.findUnique({
      where: { provider_eventId: { provider: opts.provider, eventId: opts.eventId } },
    });
    if (existing) {
      const isDuplicate = existing.status === "SUCCESS";
      return { isDuplicate, event: existing };
    }
    const event = await db.webhookEvent.create({
      data: {
        provider: opts.provider,
        eventId: opts.eventId,
        eventType: opts.eventType ?? null,
        payloadHash,
        status: "PENDING",
        payload: payloadStr,
      },
    });
    return { isDuplicate: false, event };
  },

  async markSuccess(provider: string, eventId: string) {
    return db.webhookEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: { status: "SUCCESS", processedAt: new Date(), error: null },
    });
  },

  async markFailed(provider: string, eventId: string, error: string, status: "FAILED" | "RETRYING" = "FAILED") {
    return db.webhookEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: { status, error, retryCount: { increment: 1 }, processedAt: new Date() },
    });
  },

  async list(opts: { page: number; limit: number; provider?: string; status?: string }) {
    const where: Prisma.WebhookEventWhereInput = {};
    if (opts.provider) where.provider = opts.provider;
    if (opts.status) where.status = opts.status;
    const [items, total] = await Promise.all([
      db.webhookEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      db.webhookEvent.count({ where }),
    ]);
    return { items, total };
  },

  async retry(id: string) {
    const event = await db.webhookEvent.findUnique({ where: { id } });
    if (!event) throw new Error("Webhook event not found");
    // re-process is the caller's responsibility; here we just reset status
    return db.webhookEvent.update({
      where: { id },
      data: { status: "RETRYING", error: null },
    });
  },
};
