import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { AuditService } from "./audit";
import { ConversationService } from "./conversation";
import { NotificationService } from "./notification";
import { WebhookService } from "./webhook";
import { MessageTemplateService } from "./message-template";

export type WhatsAppConfig = {
  name: string;
  phoneNumberId: string;
  phoneNumber?: string;
  businessAccountId?: string;
  wabaId?: string;
  accessToken: string;
  appSecret?: string;
  webhookVerifyToken?: string;
};

// WhatsAppService — WhatsApp Business Cloud API integration.
// Access tokens AND app secrets are NEVER returned to the client.
// Webhook processing is idempotent via WebhookEvent (provider="whatsapp").
//
// Outbound messages go through the official Cloud API:
//   POST https://graph.facebook.com/v20.0/<phone_number_id>/messages
// with Authorization: Bearer <accessToken>
export const WhatsAppService = {
  async listConnections() {
    const rows = await db.whatsAppConnection.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      phoneNumberId: c.phoneNumberId,
      phoneNumber: c.phoneNumber,
      businessAccountId: c.businessAccountId,
      wabaId: c.wabaId,
      status: c.status,
      lastSyncAt: c.lastSyncAt,
      hasToken: !!c.accessToken,
      accessTokenMasked: c.accessToken ? `${c.accessToken.slice(0, 4)}****` : "",
      hasAppSecret: !!c.appSecret,
    }));
  },

  async createConnection(data: WhatsAppConfig) {
    const user = await getCurrentUser();
    const conn = await db.whatsAppConnection.create({
      data: {
        name: data.name,
        phoneNumberId: data.phoneNumberId,
        phoneNumber: data.phoneNumber,
        businessAccountId: data.businessAccountId,
        wabaId: data.wabaId,
        accessToken: data.accessToken,
        appSecret: data.appSecret,
        webhookVerifyToken: data.webhookVerifyToken,
        status: "CONNECTED",
        createdBy: user?.id,
      },
    });
    await AuditService.logFromRequest({ action: "WHATSAPP_CONNECT", entity: "WhatsAppConnection", entityId: conn.id });
    return { id: conn.id };
  },

  async updateConnection(id: string, data: Partial<WhatsAppConfig> & { status?: string }) {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.phoneNumber !== undefined) update.phoneNumber = data.phoneNumber;
    if (data.businessAccountId !== undefined) update.businessAccountId = data.businessAccountId;
    if (data.wabaId !== undefined) update.wabaId = data.wabaId;
    if (data.accessToken) update.accessToken = data.accessToken;
    if (data.appSecret) update.appSecret = data.appSecret;
    if (data.webhookVerifyToken !== undefined) update.webhookVerifyToken = data.webhookVerifyToken;
    if (data.status) update.status = data.status;
    return db.whatsAppConnection.update({ where: { id }, data: update });
  },

  async deleteConnection(id: string) {
    return db.whatsAppConnection.delete({ where: { id } });
  },

  async getConnection(id: string) {
    return db.whatsAppConnection.findUnique({ where: { id } });
  },

  // Webhook verification (GET hub.challenge)
  verifyWebhook(mode: string | null, token: string | null, challenge: string | null, expectedToken: string | null) {
    if (mode !== "subscribe" || !token || !challenge) return null;
    if (expectedToken && token !== expectedToken) return null;
    return challenge;
  },

  // Process inbound webhook (Cloud API). Idempotent by wamid (message id).
  async processWebhook(payload: any, connectionId?: string) {
    const entries = payload?.entry ?? [];
    const results: string[] = [];
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        if (!value) continue;
        const phone = value?.messages?.[0]?.from;
        const msgId = value?.messages?.[0]?.id;
        // Incoming message
        if (value?.messages?.length) {
          const m = value.messages[0];
          const eventId = m.id ?? `wa-${phone}-${m.timestamp}`;
          const { isDuplicate } = await WebhookService.recordEvent({ provider: "whatsapp", eventId, eventType: "message", payload: value });
          if (isDuplicate) { results.push(`dup:${eventId}`); continue; }
          try {
            await this.handleIncoming(value, connectionId);
            await WebhookService.markSuccess("whatsapp", eventId);
            results.push(`ok:${eventId}`);
          } catch (e) {
            await WebhookService.markFailed("whatsapp", eventId, (e as Error).message, "FAILED");
            results.push(`err:${eventId}`);
          }
        }
        // Status updates (delivered/read)
        if (value?.statuses?.length) {
          for (const s of value.statuses) {
            const eventId = `status-${s.id}-${s.status}`;
            const { isDuplicate } = await WebhookService.recordEvent({ provider: "whatsapp", eventId, eventType: "status", payload: s });
            if (isDuplicate) continue;
            await this.updateMessageStatus(s.id, s.status);
            await WebhookService.markSuccess("whatsapp", eventId);
            results.push(`status:${s.id}:${s.status}`);
          }
        }
      }
    }
    return results;
  },

  async handleIncoming(value: any, connectionId?: string) {
    const msg = value?.messages?.[0];
    if (!msg) return;
    const phone = msg.from; // E.164
    const contactName = value?.contacts?.[0]?.wa_id ? (value.contacts[0].profile?.name ?? phone) : phone;
    const text = msg?.text?.body ?? msg?.button?.text ?? "[media]";
    const conversation = await ConversationService.upsertByExternal({
      provider: "whatsapp",
      externalConversationId: phone,
      providerConnectionId: connectionId,
      contactName,
      contactPhone: phone,
      lastMessagePreview: text,
    });
    // Link to a CRM customer by phone if one exists
    const customer = await db.customer.findUnique({ where: { phone } });
    if (customer) await ConversationService.linkCustomer(conversation.id, customer.id);

    await ConversationService.appendMessage({
      conversationId: conversation.id,
      direction: "INCOMING",
      provider: "whatsapp",
      body: text,
      externalMessageId: msg.id,
      mediaType: msg.type === "text" ? "text" : msg.type ?? "text",
      mediaUrl: msg[`${msg.type}`]?.id ?? undefined,
    });
    await NotificationService.create({
      type: "NEW_MESSAGE",
      title: "New WhatsApp message",
      message: `${contactName}: ${text.slice(0, 80)}`,
      link: `/inbox?conversation=${conversation.id}`,
    });
  },

  async updateMessageStatus(externalMessageId: string, status: string) {
    await db.message.updateMany({ where: { externalMessageId }, data: { status: status.toUpperCase() } });
  },

  // Send an outbound WhatsApp message via the official Cloud API.
  // Returns the wamid (or null if the connection is not configured).
  async sendMessage(opts: { connectionId: string; conversationId: string; to: string; body: string; templateId?: string; sentBy?: string }) {
    const conn = await db.whatsAppConnection.findUnique({ where: { id: opts.connectionId } });
    if (!conn) throw new Error("WhatsApp connection not found");
    const template = opts.templateId ? await db.messageTemplate.findUnique({ where: { id: opts.templateId } }) : null;

    // Persist the message as PENDING first
    const msg = await ConversationService.appendMessage({
      conversationId: opts.conversationId,
      direction: "OUTGOING",
      provider: "whatsapp",
      body: opts.body,
      templateId: opts.templateId,
      status: "PENDING",
      sentBy: opts.sentBy,
    });

    try {
      const url = `https://graph.facebook.com/v20.0/${conn.phoneNumberId}/messages`;
      const payload = template
        ? {
            messaging_product: "whatsapp",
            to: opts.to.replace(/[^0-9]/g, ""),
            type: "template",
            template: { name: template.externalId ?? template.name, language: { code: template.language || "en" } },
          }
        : {
            messaging_product: "whatsapp",
            to: opts.to.replace(/[^0-9]/g, ""),
            type: "text",
            text: { body: opts.body },
          };
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        await db.message.update({ where: { id: msg.id }, data: { status: "FAILED", errorMessage: data?.error?.message ?? `HTTP ${res.status}` } });
        throw new Error(data?.error?.message ?? `WhatsApp API error ${res.status}`);
      }
      const wamid = data?.messages?.[0]?.id;
      await db.message.update({ where: { id: msg.id }, data: { status: "SENT", externalMessageId: wamid } });
      await db.conversation.update({ where: { id: opts.conversationId }, data: { lastMessageAt: new Date(), lastMessagePreview: opts.body.slice(0, 120) } });
      return { messageId: msg.id, wamid };
    } catch (e) {
      await db.message.update({ where: { id: msg.id }, data: { status: "FAILED", errorMessage: (e as Error).message } });
      throw e;
    }
  },

  // Send a transactional order notification using an approved template.
  // Looks up the template by name (e.g. "order_received") and renders variables.
  async sendOrderNotification(opts: { connectionId: string; conversationId: string; to: string; templateName: string; variables: Record<string, string> }) {
    const template = await db.messageTemplate.findUnique({ where: { name: opts.templateName } });
    if (!template || template.channel !== "whatsapp" || !template.isApproved) {
      throw new Error(`WhatsApp template "${opts.templateName}" not found or not approved`);
    }
    const body = MessageTemplateService.render(template.body, opts.variables);
    return this.sendMessage({
      connectionId: opts.connectionId,
      conversationId: opts.conversationId,
      to: opts.to,
      body,
      templateId: template.id,
    });
  },
};
