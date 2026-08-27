import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { AuditService } from "./audit";
import { ConversationService } from "./conversation";
import { NotificationService } from "./notification";
import { WebhookService } from "./webhook";

export type MetaConfig = {
  facebookPageId?: string;
  facebookPageName?: string;
  instagramBusinessId?: string;
  instagramUsername?: string;
  accessToken: string;
  appSecret?: string;
  appId?: string;
  webhookVerifyToken?: string;
};

// MetaService — Facebook Page + Instagram Business integration.
// Supports multiple Meta connections. Access tokens AND app secrets are
// NEVER returned to the client (the GET endpoint masks them).
//
// Webhook processing is idempotent: duplicate deliveries update the same
// WebhookEvent row keyed on (provider="meta", eventId).
export const MetaService = {
  async listConnections() {
    const rows = await db.metaConnection.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { leads: true } } } });
    // NEVER expose accessToken or appSecret
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      facebookPageId: c.facebookPageId,
      facebookPageName: c.facebookPageName,
      instagramBusinessId: c.instagramBusinessId,
      instagramUsername: c.instagramUsername,
      appId: c.appId,
      connectedUserId: c.connectedUserId,
      status: c.status,
      lastSyncAt: c.lastSyncAt,
      tokenExpiresAt: c.tokenExpiresAt,
      leadCount: c._count.leads,
      hasToken: !!c.accessToken,
      accessTokenMasked: c.accessToken ? `${c.accessToken.slice(0, 4)}****` : "",
      hasAppSecret: !!c.appSecret,
    }));
  },

  async createConnection(data: MetaConfig & { name: string }) {
    const user = await getCurrentUser();
    const conn = await db.metaConnection.create({
      data: {
        name: data.name,
        facebookPageId: data.facebookPageId,
        facebookPageName: data.facebookPageName,
        instagramBusinessId: data.instagramBusinessId,
        instagramUsername: data.instagramUsername,
        accessToken: data.accessToken,
        appSecret: data.appSecret,
        appId: data.appId,
        webhookVerifyToken: data.webhookVerifyToken,
        connectedUserId: data.facebookPageId,
        status: "CONNECTED",
        createdBy: user?.id,
      },
    });
    await AuditService.logFromRequest({ action: "META_CONNECT", entity: "MetaConnection", entityId: conn.id });
    return { id: conn.id };
  },

  async updateConnection(id: string, data: Partial<MetaConfig> & { name?: string; status?: string }) {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.facebookPageId !== undefined) update.facebookPageId = data.facebookPageId;
    if (data.facebookPageName !== undefined) update.facebookPageName = data.facebookPageName;
    if (data.instagramBusinessId !== undefined) update.instagramBusinessId = data.instagramBusinessId;
    if (data.instagramUsername !== undefined) update.instagramUsername = data.instagramUsername;
    if (data.appId !== undefined) update.appId = data.appId;
    if (data.webhookVerifyToken !== undefined) update.webhookVerifyToken = data.webhookVerifyToken;
    if (data.accessToken) update.accessToken = data.accessToken; // only update if provided
    if (data.appSecret) update.appSecret = data.appSecret; // only update if provided
    if (data.status) update.status = data.status;
    return db.metaConnection.update({ where: { id }, data: update });
  },

  async deleteConnection(id: string) {
    return db.metaConnection.delete({ where: { id } });
  },

  async getConnection(id: string) {
    return db.metaConnection.findUnique({ where: { id } });
  },

  // Webhook verification (Meta GET challenge)
  verifyWebhook(mode: string | null, token: string | null, challenge: string | null, expectedToken: string | null) {
    if (mode !== "subscribe" || !token || !challenge) return null;
    if (expectedToken && token !== expectedToken) return null;
    return challenge;
  },

  // Import a Meta lead. Idempotent by externalLeadId.
  // Creates/links a CRM customer by phone (duplicate prevention).
  async importLead(opts: {
    connectionId?: string;
    externalLeadId: string;
    name: string;
    phone?: string;
    email?: string;
    source?: string;
    campaign?: string;
    ad?: string;
    form?: string;
    payload?: unknown;
  }) {
    const existing = await db.metaLead.findUnique({ where: { externalLeadId: opts.externalLeadId } });
    if (existing) return existing;

    // Find-or-create a customer by phone (duplicate prevention)
    let customerId: string | undefined;
    if (opts.phone) {
      const existingCustomer = await db.customer.findUnique({ where: { phone: opts.phone } });
      if (existingCustomer) customerId = existingCustomer.id;
      else {
        const created = await db.customer.create({
          data: { name: opts.name, phone: opts.phone!, email: opts.email, notes: `Imported from Meta Lead ${opts.externalLeadId}` },
        });
        customerId = created.id;
      }
    }

    const lead = await db.metaLead.create({
      data: {
        connectionId: opts.connectionId ?? null,
        externalLeadId: opts.externalLeadId,
        name: opts.name,
        phone: opts.phone,
        email: opts.email,
        source: opts.source,
        campaign: opts.campaign,
        ad: opts.ad,
        form: opts.form,
        customerId: customerId ?? null,
        payload: opts.payload ? JSON.stringify(opts.payload) : null,
        status: "NEW",
      },
    });

    await NotificationService.create({
      type: "NEW_LEAD",
      title: "New Meta lead imported",
      message: `${opts.name}${opts.phone ? ` · ${opts.phone}` : ""}${opts.campaign ? ` · ${opts.campaign}` : ""}`,
      link: `/inbox?lead=${lead.id}`,
    });
    // Route to Telegram groups (non-blocking)
    void (import("./telegram").then(({ TelegramService }) =>
      TelegramService.routeNotification("NEW_LEAD", `🎯 <b>NEW LEAD</b>\n${opts.name}${opts.phone ? ` · ${opts.phone}` : ""}${opts.campaign ? ` · ${opts.campaign}` : ""}`)
    ).catch(() => {}));
    return lead;
  },

  async listLeads(opts: { page: number; limit: number; status?: string; search?: string }) {
    const where: any = {};
    if (opts.status) where.status = opts.status;
    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search } },
        { phone: { contains: opts.search } },
        { email: { contains: opts.search } },
        { campaign: { contains: opts.search } },
      ];
    }
    const [items, total] = await Promise.all([
      db.metaLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        include: { customer: { select: { id: true, name: true, phone: true } }, connection: { select: { name: true, facebookPageName: true } } },
      }),
      db.metaLead.count({ where }),
    ]);
    return { items, total };
  },

  // Process an inbound Meta webhook (messaging/leadgen). Idempotent.
  async processWebhook(payload: any, connectionId?: string) {
    // Meta sends { entry: [{ id, messaging: [...], changes: [{ field: "leadgen", value: ... }] }] }
    const entries = payload?.entry ?? [];
    const results: string[] = [];
    for (const entry of entries) {
      const pageId = entry.id;
      // Messaging (Messenger)
      for (const msg of entry.messaging ?? []) {
        const eventId = msg?.message?.mid ?? `${pageId}-${msg?.sender?.id}-${msg?.timestamp}`;
        const { isDuplicate } = await WebhookService.recordEvent({ provider: "meta", eventId, eventType: "messaging", payload: msg });
        if (isDuplicate) { results.push(`dup:${eventId}`); continue; }
        try {
          await this.handleIncomingMessage(msg, connectionId, pageId);
          await WebhookService.markSuccess("meta", eventId);
          results.push(`ok:${eventId}`);
        } catch (e) {
          await WebhookService.markFailed("meta", eventId, (e as Error).message, "FAILED");
          results.push(`err:${eventId}`);
        }
      }
      // Leadgen
      for (const change of entry.changes ?? []) {
        if (change.field === "leadgen") {
          const leadgen = change.value?.leadgen_event_id ?? change.value?.leadgen_id ?? `${pageId}-${change.value?.form_id}-${change.value?.ad_id}-${change.value?.created_time}`;
          const { isDuplicate } = await WebhookService.recordEvent({ provider: "meta", eventId: leadgen, eventType: "leadgen", payload: change.value });
          if (isDuplicate) { results.push(`dup:${leadgen}`); continue; }
          try {
            await this.importLeadFromWebhook(change.value, connectionId);
            await WebhookService.markSuccess("meta", leadgen);
            results.push(`ok:${leadgen}`);
          } catch (e) {
            await WebhookService.markFailed("meta", leadgen, (e as Error).message, "FAILED");
            results.push(`err:${leadgen}`);
          }
        }
      }
    }
    return results;
  },

  async handleIncomingMessage(msg: any, connectionId: string | undefined, pageId: string | undefined) {
    const senderId = msg?.sender?.id;
    const recipientId = msg?.recipient?.id;
    const text = msg?.message?.text ?? "[attachment]";
    if (!senderId) return;
    // find-or-create conversation (externalConversationId = senderId for 1:1 messages)
    const conversation = await ConversationService.upsertByExternal({
      provider: "facebook",
      externalConversationId: senderId,
      providerConnectionId: connectionId,
      contactName: msg?.sender?.name ?? senderId,
      lastMessagePreview: text,
    });
    await ConversationService.appendMessage({
      conversationId: conversation.id,
      direction: "INCOMING",
      provider: "facebook",
      body: text,
      externalMessageId: msg?.message?.mid,
      mediaType: msg?.message?.attachments ? "image" : "text",
      mediaUrl: msg?.message?.attachments?.[0]?.payload?.url,
    });
    await NotificationService.create({
      type: "NEW_MESSAGE",
      title: "New Facebook message",
      message: text.slice(0, 100),
      link: `/inbox?conversation=${conversation.id}`,
    });
  },

  async importLeadFromWebhook(value: any, connectionId?: string) {
    // value contains field_data (array of { name, values }) + campaign/ad context
    const fieldData: { name: string; values: string[] }[] = value?.field_data ?? [];
    const get = (n: string) => fieldData.find((f) => f.name?.toLowerCase() === n)?.values?.[0];
    return this.importLead({
      connectionId,
      externalLeadId: value?.leadgen_id ?? value?.leadgen_event_id ?? `lead-${value?.form_id}-${value?.ad_id}-${value?.created_time}`,
      name: get("full_name") ?? get("first_name") ?? "Meta Lead",
      phone: get("phone_number") ?? get("phone"),
      email: get("email"),
      source: value?.page_id ?? "Meta Lead Ad",
      campaign: value?.campaign_id,
      ad: value?.ad_id,
      form: value?.form_id,
      payload: value,
    });
  },
};
