import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { resolveRolePermissions } from "@/lib/auth";
import { RoleName, Permission } from "@/lib/constants";
import { AuditService } from "./audit";

// TelegramService — bot configuration, RBAC resolution, message sending.
//
// Identity is by Telegram user ID (numeric string), NOT username.
// RBAC flow:  Telegram User → Current Group → Role → Permissions → CRM Action
// The same Telegram user can have different roles in different groups.
//
// Bot token is stored server-side and NEVER returned to the client (masked).

export type TelegramConfig = {
  botToken: string;
  botUsername?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  defaultLanguage?: string;
};

export const TelegramService = {
  async getConfig(): Promise<TelegramConfig | null> {
    const bot = await db.telegramBot.findFirst();
    if (!bot) return null;
    return {
      botToken: bot.botToken,
      botUsername: bot.botUsername ?? undefined,
      webhookUrl: bot.webhookUrl ?? undefined,
      webhookSecret: bot.webhookSecret ?? undefined,
      defaultLanguage: bot.defaultLanguage ?? "en",
    };
  },

  async getStatus() {
    const bot = await db.telegramBot.findFirst({ include: { _count: { select: { groups: true } } } });
    if (!bot) return { connected: false, status: "DISCONNECTED" };
    return {
      connected: !!bot.botToken,
      status: bot.status,
      botUsername: bot.botUsername,
      webhookUrl: bot.webhookUrl,
      lastWebhookAt: bot.lastWebhookAt,
      defaultLanguage: bot.defaultLanguage,
      groupCount: bot._count.groups,
      botTokenMasked: bot.botToken ? `${bot.botToken.slice(0, 6)}****${bot.botToken.slice(-4)}` : "",
    };
  },

  async saveConfig(cfg: Partial<TelegramConfig>) {
    const existing = await db.telegramBot.findFirst();
    const merged: any = {
      botToken: cfg.botToken ?? existing?.botToken ?? "",
      botUsername: cfg.botUsername ?? existing?.botUsername ?? undefined,
      webhookUrl: cfg.webhookUrl ?? existing?.webhookUrl ?? undefined,
      webhookSecret: cfg.webhookSecret ?? existing?.webhookSecret ?? undefined,
      defaultLanguage: cfg.defaultLanguage ?? existing?.defaultLanguage ?? "en",
      status: "CONNECTED",
    };
    if (existing) {
      return db.telegramBot.update({ where: { id: existing.id }, data: merged });
    }
    return db.telegramBot.create({ data: merged });
  },

  async setWebhook(url: string) {
    const cfg = await this.getConfig();
    if (!cfg?.botToken || cfg.botToken === "PLACEHOLDER_BOT_TOKEN_REPLACE_WITH_REAL_TELEGRAM_BOT_TOKEN") {
      throw new Error("Bot token not configured. Enter a real bot token from @BotFather in the Config tab first.");
    }
    // Telegram setWebhook API call
    const apiUrl = `https://api.telegram.org/bot${cfg.botToken}/setWebhook`;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, secret_token: cfg.webhookSecret || undefined }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description || "Failed to set webhook");
    const bot = await db.telegramBot.findFirst();
    if (bot) await db.telegramBot.update({ where: { id: bot.id }, data: { webhookUrl: url, status: "CONNECTED" } });
    return data;
  },

  // RBAC resolution: Telegram user ID + chat ID → effective permissions
  async resolvePermissions(telegramUserId: string, chatId: string): Promise<{ roleName: RoleName; permissions: Permission[]; group: any; user: any } | null> {
    const group = await db.telegramGroup.findUnique({
      where: { chatId },
      include: {
        memberships: { where: { user: { telegramId: telegramUserId } }, include: { user: true } },
        bot: true,
      },
    });
    if (!group || !group.isActive) return null;
    // find the user's membership in this group → role within group
    const membership = group.memberships[0];
    const roleName = (membership?.roleName ?? group.roleName) as RoleName;
    // if no membership, only allow if the group is open (default role applies)
    const user = membership?.user;
    if (user?.isBlocked) return null;
    const permissions = resolveRolePermissions(roleName);
    return { roleName, permissions, group, user: user ?? { telegramId: telegramUserId } };
  },

  async hasPermission(telegramUserId: string, chatId: string, permission: Permission): Promise<boolean> {
    const ctx = await this.resolvePermissions(telegramUserId, chatId);
    if (!ctx) return false;
    if (ctx.roleName === "SUPER_ADMIN" || ctx.roleName === "ADMIN") return true;
    return ctx.permissions.includes(permission);
  },

  // Send a message to a chat (group or user)
  async sendMessage(chatId: string, text: string, keyboard?: any) {
    const cfg = await this.getConfig();
    if (!cfg?.botToken || cfg.botToken === "PLACEHOLDER_BOT_TOKEN_REPLACE_WITH_REAL_TELEGRAM_BOT_TOKEN") {
      console.log("[TelegramService] Bot not configured — message would be sent to", chatId, ":", text.slice(0, 80));
      return { ok: false, description: "Bot token not configured. Set a real bot token in Integrations → Telegram Bot → Config." };
    }
    const body: any = { chat_id: chatId, text, parse_mode: "HTML" };
    if (keyboard) body.reply_markup = keyboard;
    try {
      const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        console.error("[TelegramService] sendMessage failed:", data.description);
        return { ok: false, description: data.description };
      }
      return data;
    } catch (e) {
      console.error("[TelegramService] sendMessage failed:", (e as Error).message);
      return { ok: false, description: (e as Error).message };
    }
  },

  // Answer a callback query (dismisses the loading indicator)
  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    const cfg = await this.getConfig();
    if (!cfg?.botToken || cfg.botToken === "PLACEHOLDER_BOT_TOKEN_REPLACE_WITH_REAL_TELEGRAM_BOT_TOKEN") return;
    try {
      await fetch(`https://api.telegram.org/bot${cfg.botToken}/answerCallbackQuery`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
      });
    } catch { /* ignore */ }
  },

  // Edit a message (used for pagination / refresh)
  async editMessage(chatId: string, messageId: number, text: string, keyboard?: any) {
    const cfg = await this.getConfig();
    if (!cfg?.botToken || cfg.botToken === "PLACEHOLDER_BOT_TOKEN_REPLACE_WITH_REAL_TELEGRAM_BOT_TOKEN") return;
    const body: any = { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" };
    if (keyboard) body.reply_markup = keyboard;
    try {
      await fetch(`https://api.telegram.org/bot${cfg.botToken}/editMessageText`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch { /* ignore */ }
  },

  // --- Group management ---
  async listGroups() {
    return db.telegramGroup.findMany({ orderBy: { chatTitle: "asc" }, include: { _count: { select: { memberships: true, notifications: true } } } });
  },
  async upsertGroup(chatId: string, data: { chatTitle: string; chatType?: string; roleName?: string; isActive?: boolean; welcomeText?: string; botId: string }) {
    return db.telegramGroup.upsert({
      where: { chatId },
      create: { chatId, chatTitle: data.chatTitle, chatType: data.chatType ?? "group", roleName: data.roleName ?? "SALES", isActive: data.isActive ?? true, welcomeText: data.welcomeText, botId: data.botId },
      update: { chatTitle: data.chatTitle, roleName: data.roleName ?? undefined, isActive: data.isActive, welcomeText: data.welcomeText },
    });
  },
  async updateGroup(id: string, data: Partial<{ chatId: string; chatTitle: string; roleName: string; isActive: boolean; welcomeText: string }>) {
    return db.telegramGroup.update({ where: { id }, data });
  },
  async deleteGroup(id: string) {
    return db.telegramGroup.delete({ where: { id } });
  },

  // --- User management ---
  async upsertUser(telegramId: string, data: { username?: string; firstName?: string; lastName?: string; language?: string }) {
    return db.telegramUser.upsert({
      where: { telegramId },
      create: { telegramId, ...data },
      update: { ...data, updatedAt: new Date() },
    });
  },
  async listUsers() {
    return db.telegramUser.findMany({ orderBy: { createdAt: "desc" }, include: { memberships: { include: { group: { select: { chatTitle: true } } } } } });
  },
  async assignMembership(groupId: string, telegramId: string, roleName: string) {
    const user = await this.upsertUser(telegramId, {});
    return db.telegramGroupMembership.upsert({
      where: { groupId_userId: { groupId, userId: user.id } },
      create: { groupId, userId: user.id, roleName },
      update: { roleName },
    });
  },
  async removeMembership(groupId: string, telegramId: string) {
    const user = await db.telegramUser.findUnique({ where: { telegramId } });
    if (!user) return;
    await db.telegramGroupMembership.deleteMany({ where: { groupId, userId: user.id } });
  },

  // --- Audit ---
  async logAction(opts: { groupId?: string; userId?: string; telegramUserId?: string; action: string; command?: string; payload?: unknown; result?: string }) {
    try {
      await db.telegramAuditLog.create({
        data: {
          groupId: opts.groupId ?? null,
          userId: opts.userId ?? null,
          telegramUserId: opts.telegramUserId ?? null,
          action: opts.action,
          command: opts.command,
          payload: opts.payload ? JSON.stringify(opts.payload) : null,
          result: opts.result,
        },
      });
    } catch (e) { console.error("[TelegramService] audit log failed:", e); }
  },

  async listAuditLogs(opts: { page: number; limit: number; groupId?: string; action?: string }) {
    const where: Prisma.TelegramAuditLogWhereInput = {};
    if (opts.groupId) where.groupId = opts.groupId;
    if (opts.action) where.action = opts.action;
    const [items, total] = await Promise.all([
      db.telegramAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.limit, take: opts.limit, include: { group: { select: { chatTitle: true } }, user: { select: { firstName: true, username: true, telegramId: true } } } }),
      db.telegramAuditLog.count({ where }),
    ]);
    return { items, total };
  },

  // --- Webhook idempotency ---
  async isDuplicateUpdate(updateId: string): Promise<boolean> {
    const existing = await db.telegramWebhookEvent.findUnique({ where: { updateId } });
    return !!existing && existing.status === "PROCESSED";
  },
  async recordWebhookEvent(updateId: string, status: string, payload?: unknown, error?: string) {
    const existing = await db.telegramWebhookEvent.findUnique({ where: { updateId } });
    if (existing) return existing;
    return db.telegramWebhookEvent.create({
      data: { updateId, status, payload: payload ? JSON.stringify(payload) : null, error },
    });
  },

  // --- Notification routing rules ---
  async listNotificationRules(groupId?: string) {
    const where: Prisma.TelegramNotificationRuleWhereInput = {};
    if (groupId) where.groupId = groupId;
    return db.telegramNotificationRule.findMany({ where, include: { group: { select: { chatTitle: true, chatId: true } } }, orderBy: { eventType: "asc" } });
  },
  async upsertNotificationRule(groupId: string, eventType: string, isActive = true, language = "en") {
    return db.telegramNotificationRule.upsert({
      where: { groupId_eventType: { groupId, eventType } },
      create: { groupId, eventType, isActive, language },
      update: { isActive, language },
    });
  },
  async deleteNotificationRule(id: string) {
    return db.telegramNotificationRule.delete({ where: { id } });
  },

  // Route a CRM notification event to all subscribed Telegram groups
  async routeNotification(eventType: string, message: string) {
    const rules = await db.telegramNotificationRule.findMany({ where: { eventType, isActive: true }, include: { group: true } });
    const results: { chatId: string; ok: boolean }[] = [];
    for (const rule of rules) {
      if (!rule.group?.isActive) continue;
      try {
        await this.sendMessage(rule.group.chatId, message);
        results.push({ chatId: rule.group.chatId, ok: true });
      } catch (e) {
        results.push({ chatId: rule.group.chatId, ok: false });
      }
    }
    return results;
  },
};

void AuditService; void Prisma;
