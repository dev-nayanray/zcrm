import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";

// ConversationService — the omnichannel inbox. Unifies WhatsApp / Facebook
// Messenger / Instagram into one conversation list. Each conversation links
// to a Customer and an (optional) CRM Channel.
//
// IMPORTANT: orders created FROM a conversation use the SAME OrderService —
// there is no separate "WhatsApp order" system. The conversation just links
// to the resulting order via Order.conversationId.
export const ConversationService = {
  /** Find-or-create a conversation by (provider, externalConversationId). Idempotent. */
  async upsertByExternal(opts: {
    provider: string;
    externalConversationId: string;
    providerConnectionId?: string;
    contactName?: string;
    contactPhone?: string;
    channelId?: string;
    lastMessagePreview?: string;
  }) {
    const existing = await db.conversation.findFirst({
      where: { provider: opts.provider, externalConversationId: opts.externalConversationId },
    });
    if (existing) {
      return db.conversation.update({
        where: { id: existing.id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: opts.lastMessagePreview ?? existing.lastMessagePreview,
          contactName: opts.contactName ?? existing.contactName,
          contactPhone: opts.contactPhone ?? existing.contactPhone,
        },
      });
    }
    return db.conversation.create({
      data: {
        provider: opts.provider,
        externalConversationId: opts.externalConversationId,
        providerConnectionId: opts.providerConnectionId ?? null,
        contactName: opts.contactName,
        contactPhone: opts.contactPhone,
        channelId: opts.channelId ?? null,
        lastMessageAt: new Date(),
        lastMessagePreview: opts.lastMessagePreview,
        status: "OPEN",
        unreadCount: 1,
      },
    });
  },

  /** Link a conversation to a CRM customer (Customer 360°). */
  async linkCustomer(conversationId: string, customerId: string) {
    return db.conversation.update({ where: { id: conversationId }, data: { customerId } });
  },

  /** Append an incoming/outgoing message. */
  async appendMessage(opts: {
    conversationId: string;
    direction: "INCOMING" | "OUTGOING";
    provider: string;
    body: string;
    externalMessageId?: string;
    mediaType?: string;
    mediaUrl?: string;
    templateId?: string;
    status?: string;
    errorMessage?: string;
    sentBy?: string;
  }) {
    const [msg] = await Promise.all([
      db.message.create({ data: { ...opts, status: opts.status ?? "SENT" } }),
      db.conversation.update({
        where: { id: opts.conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: opts.body.slice(0, 120),
          unreadCount: opts.direction === "INCOMING" ? { increment: 1 } : undefined,
        },
      }),
    ]);
    return msg;
  },

  /** Assign conversation to a CRM user. */
  async assign(conversationId: string, userId: string) {
    return db.conversation.update({ where: { id: conversationId }, data: { assignedUserId: userId, status: "OPEN" } });
  },

  /** Mark conversation read. */
  async markRead(conversationId: string) {
    await db.conversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } });
  },

  /** Update conversation status (OPEN|PENDING|RESOLVED|CLOSED). */
  async setStatus(conversationId: string, status: string) {
    return db.conversation.update({ where: { id: conversationId }, data: { status } });
  },

  async list(opts: { page: number; limit: number; provider?: string; status?: string; assignedUserId?: string; search?: string }) {
    const where: Prisma.ConversationWhereInput = {};
    if (opts.provider) where.provider = opts.provider;
    if (opts.status) where.status = opts.status;
    if (opts.assignedUserId) where.assignedUserId = opts.assignedUserId;
    if (opts.search) {
      where.OR = [
        { contactName: { contains: opts.search } },
        { contactPhone: { contains: opts.search } },
        { lastMessagePreview: { contains: opts.search } },
      ];
    }
    const [items, total] = await Promise.all([
      db.conversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          channel: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
      }),
      db.conversation.count({ where }),
    ]);
    return { items, total };
  },

  async get(id: string) {
    return db.conversation.findUnique({
      where: { id },
      include: {
        customer: true,
        channel: true,
        assignee: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: "asc" }, take: 500, include: { sender: { select: { id: true, name: true } } } },
        orders: { select: { id: true, orderNumber: true, status: true, total: true, createdAt: true } },
      },
    });
  },

  async messages(conversationId: string, opts: { page: number; limit: number }) {
    const [items, total] = await Promise.all([
      db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        include: { sender: { select: { id: true, name: true } } },
      }),
      db.message.count({ where: { conversationId } }),
    ]);
    return { items, total };
  },

  // Stats for the inbox header (per-provider counts + total unread)
  async stats() {
    const all = await db.conversation.findMany({ select: { provider: true, status: true, unreadCount: true } });
    const stats: Record<string, { total: number; open: number; unread: number }> = {};
    let totalUnread = 0;
    for (const c of all) {
      if (!stats[c.provider]) stats[c.provider] = { total: 0, open: 0, unread: 0 };
      stats[c.provider].total += 1;
      if (c.status === "OPEN") stats[c.provider].open += 1;
      stats[c.provider].unread += c.unreadCount;
      totalUnread += c.unreadCount;
    }
    return { byProvider: stats, totalUnread, totalConversations: all.length };
  },
};

void toDecimal;
