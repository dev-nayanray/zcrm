import { db } from "@/lib/db";
import { TelegramService } from "./telegram";
import { OrderService } from "./order";
import { PaymentService } from "./payment";
import { InventoryService } from "./inventory";
import { StockReconciliationService } from "./stock-reconciliation";
import { AccountingService } from "./accounting";
import { CashService } from "./cash";
import { LeadService } from "./lead";
import { NotificationService } from "./notification";
import { Permission } from "@/lib/constants";
import { toDecimal } from "@/lib/decimal";
import { money, num } from "@/lib/api-client";

// TelegramCommandService — dispatches Telegram commands and callback queries.
// Reuses ALL existing CRM services (no duplicate business logic).
//
// Commands: /start /help /orders /customers /inventory /payments /leads /reports /stock /due
// Inline keyboards with pagination (prev/next), action buttons, and confirmations.
// Sensitive actions (payment, refund, stock adjust, cash, return) require a
// second confirmation tap.

type CommandContext = {
  telegramUserId: string;
  chatId: string;
  chatTitle?: string;
  messageId?: number;
  callbackQueryId?: string;
  user: { id?: string; telegramId: string; firstName?: string; username?: string; language?: string } | null;
  group: { id: string; chatId: string; chatTitle: string; roleName: string; botId: string };
  roleName: string;
  permissions: string[];
};

export const TelegramCommandService = {
  // Process an incoming Telegram update (message or callback_query)
  async processUpdate(update: any) {
    const updateId = String(update.update_id);
    if (await TelegramService.isDuplicateUpdate(updateId)) {
      await TelegramService.recordWebhookEvent(updateId, "IGNORED", update);
      return { ok: true, duplicate: true };
    }

    let result = { ok: true, action: "none" };
    try {
      if (update.message) {
        result = await this.handleMessage(update.message);
      } else if (update.callback_query) {
        result = await this.handleCallback(update.callback_query);
      }
      await TelegramService.recordWebhookEvent(updateId, "PROCESSED", update);
    } catch (e) {
      // If sendMessage fails (e.g. bot token not configured), still mark as processed
      // so Telegram doesn't keep retrying. Log the error.
      await TelegramService.recordWebhookEvent(updateId, "FAILED", update, (e as Error).message);
      console.error("[TelegramCommandService] processUpdate error:", e);
      result = { ok: true, action: "error" } as any;
    }
    return result;
  },

  async resolveContext(telegramUserId: string, chatId: string, chatTitle?: string): Promise<CommandContext | null> {
    const ctx = await TelegramService.resolvePermissions(telegramUserId, String(chatId));
    if (!ctx) return null;
    // ensure the user record exists
    const user = await TelegramService.upsertUser(telegramUserId, { firstName: ctx.user?.firstName, username: ctx.user?.username, language: ctx.user?.language });
    return {
      telegramUserId, chatId: String(chatId), chatTitle,
      user: user as any, group: ctx.group as any, roleName: ctx.roleName, permissions: ctx.permissions as string[],
    };
  },

  async handleMessage(msg: any): Promise<{ ok: boolean; action: string }> {
    const chatId = String(msg.chat.id);
    const fromId = String(msg.from.id);
    const text = msg.text ?? "";
    const chatTitle = msg.chat.title;

    // upsert user record from message metadata
    await TelegramService.upsertUser(fromId, { username: msg.from.username, firstName: msg.from.first_name, lastName: msg.from.last_name });

    // Private (1:1) chats are NOT gated by TelegramGroup membership — a
    // TelegramGroup only exists for team group chats. Account-linking
    // (for login two-factor auth) and a friendly /start happen here so a
    // brand-new user DMing the bot doesn't just get silence/"unauthorized",
    // which is the #1 reason people think the bot is "not working".
    if (msg.chat.type === "private") {
      return this.handlePrivateMessage(chatId, fromId, msg);
    }

    const ctx = await this.resolveContext(fromId, chatId, chatTitle);
    if (!ctx) {
      await TelegramService.sendMessage(chatId, this.t("unauthorized", "en"));
      return { ok: false, action: "unauthorized" };
    }
    const lang = ctx.user?.language ?? "en";
    const [cmd, ...args] = text.split(" ");
    const command = cmd.toLowerCase();

    if (command === "/start") {
      await this.sendStart(ctx, lang);
      await TelegramService.logAction({ groupId: ctx.group.id, userId: ctx.user?.id, telegramUserId: fromId, action: "COMMAND", command: "/start", result: "ok" });
      return { ok: true, action: "start" };
    }
    if (command === "/help") {
      await this.sendHelp(ctx, lang);
      return { ok: true, action: "help" };
    }

    // Module commands
    const handlerMap: Record<string, (ctx: CommandContext, args: string[], lang: string) => Promise<void>> = {
      "/orders": this.cmdOrders, "/customers": this.cmdCustomers, "/inventory": this.cmdInventory,
      "/stock": this.cmdInventory, "/payments": this.cmdPayments, "/leads": this.cmdLeads,
      "/due": this.cmdDue, "/reports": this.cmdReports, "/cash": this.cmdCash, "/deliveries": this.cmdDeliveries,
      "/returns": this.cmdReturns, "/purchases": this.cmdPurchases, "/suppliers": this.cmdSuppliers,
      "/expenses": this.cmdExpenses, "/products": this.cmdProducts, "/stockcount": this.cmdStockCount,
      "/movements": this.cmdStockMovements, "/warehouses": this.cmdWarehouses, "/transfers": this.cmdTransfers,
      "/inbox": this.cmdInbox, "/notifications": this.cmdNotifications, "/pipeline": this.cmdPipeline,
    };
    const handler = handlerMap[command];
    if (handler) {
      try {
        await handler.call(this, ctx, args, lang);
        await TelegramService.logAction({ groupId: ctx.group.id, userId: ctx.user?.id, telegramUserId: fromId, action: "COMMAND", command, payload: args, result: "ok" });
        return { ok: true, action: command.slice(1) };
      } catch (e) {
        await TelegramService.sendMessage(chatId, `❌ ${(e as Error).message}`);
        return { ok: false, action: command };
      }
    }

    // Unknown command
    if (text.startsWith("/")) {
      await TelegramService.sendMessage(chatId, this.t("unknownCommand", lang));
    }
    return { ok: true, action: "ignored" };
  },

  // Handle a message sent to the bot in a private (1:1) chat. Not gated by
  // TelegramGroup membership — used for account linking (2FA) and a
  // friendly onboarding message.
  async handlePrivateMessage(chatId: string, fromId: string, msg: any): Promise<{ ok: boolean; action: string }> {
    const { TwoFactorService } = await import("./two-factor");
    const text: string = msg.text ?? "";
    const [cmd, ...args] = text.trim().split(/\s+/);
    const command = cmd?.toLowerCase();

    if (command === "/start") {
      await TelegramService.sendMessage(
        chatId,
        `👋 <b>Welcome to Z-CRM Bot!</b>\n\n` +
          `• To use CRM commands (orders, inventory, leads, etc.), ask an admin to add this bot to your team's Telegram group.\n` +
          `• To enable two-step login verification for your account, go to CRM → Settings → Security → Connect Telegram, then send me the code shown there as:\n<code>/link YOUR_CODE</code>`,
      );
      return { ok: true, action: "private_start" };
    }

    if (command === "/link") {
      const code = args[0];
      if (!code) {
        await TelegramService.sendMessage(chatId, "Usage: <code>/link YOUR_CODE</code>\nGet a code from CRM → Settings → Security → Connect Telegram.");
        return { ok: true, action: "private_link_usage" };
      }
      const result = await TwoFactorService.consumeLinkCode(code, fromId, {
        username: msg.from.username,
        firstName: msg.from.first_name,
        lastName: msg.from.last_name,
      });
      await TelegramService.sendMessage(chatId, result.message);
      return { ok: result.ok, action: "private_link" };
    }

    if (command === "/unlink") {
      const linked = await db.telegramUser.findUnique({ where: { telegramId: fromId } });
      if (linked?.crmUserId) {
        await TwoFactorService.unlink(linked.crmUserId);
        await TelegramService.sendMessage(chatId, "🔓 Unlinked. Two-step verification has been disabled for your account.");
      } else {
        await TelegramService.sendMessage(chatId, "No linked CRM account found.");
      }
      return { ok: true, action: "private_unlink" };
    }

    await TelegramService.sendMessage(chatId, "❓ Send /start to see what I can do here, or /link YOUR_CODE to connect your CRM account.");
    return { ok: true, action: "private_unknown" };
  },

  async handleCallback(cb: any): Promise<{ ok: boolean; action: string }> {
    const chatId = String(cb.message?.chat?.id);
    const fromId = String(cb.from.id);
    const data = cb.data ?? "";
    const messageId = cb.message?.message_id;

    await TelegramService.answerCallbackQuery(cb.id);
    const ctx = await this.resolveContext(fromId, chatId);
    if (!ctx) {
      await TelegramService.sendMessage(chatId, this.t("unauthorized", "en"));
      return { ok: false, action: "unauthorized_callback" };
    }
    const lang = ctx.user?.language ?? "en";

    try {
      await this.handleCallbackData(ctx, data, messageId, lang);
      await TelegramService.logAction({ groupId: ctx.group.id, userId: ctx.user?.id, telegramUserId: fromId, action: "CALLBACK", command: data, result: "ok" });
      return { ok: true, action: "callback" };
    } catch (e) {
      await TelegramService.sendMessage(chatId, `❌ ${(e as Error).message}`);
      return { ok: false, action: "callback_error" };
    }
  },

  // Callback data dispatch: action:param:value
  async handleCallbackData(ctx: CommandContext, data: string, messageId: number | undefined, lang: string) {
    const [action, ...rest] = data.split(":");
    const params = rest.join(":").split("|");

    switch (action) {
      case "orders_page": return this.paginateOrders(ctx, Number(params[0]) || 1, messageId, lang);
      case "order_view": return this.viewOrder(ctx, params[0], messageId, lang);
      case "order_status": return this.setOrderStatus(ctx, params[0], params[1], messageId, lang);
      case "order_status_confirm": return this.confirmOrderStatus(ctx, params[0], params[1], messageId, lang);
      case "order_pay": return this.payOrderPrompt(ctx, params[0], messageId, lang);
      case "order_pay_confirm": return this.confirmPayOrder(ctx, params[0], params[1], messageId, lang);
      case "customers_page": return this.paginateCustomers(ctx, Number(params[0]) || 1, messageId, lang);
      case "customer_view": return this.viewCustomer(ctx, params[0], messageId, lang);
      case "payments_page": return this.paginatePayments(ctx, Number(params[0]) || 1, messageId, lang);
      case "leads_page": return this.paginateLeads(ctx, Number(params[0]) || 1, messageId, lang);
      case "lead_view": return this.viewLead(ctx, params[0], messageId, lang);
      case "lead_convert": return this.convertLead(ctx, params[0], messageId, lang);
      case "lead_convert_confirm": return this.confirmConvertLead(ctx, params[0], messageId, lang);
      case "inventory_page": return this.paginateInventory(ctx, Number(params[0]) || 1, messageId, lang);
      case "stock_adjust": return this.stockAdjustPrompt(ctx, params[0], messageId, lang);
      case "stock_adjust_confirm": return this.confirmStockAdjust(ctx, params[0], params[1], messageId, lang);
      case "stockcount_page": return this.paginateStockCounts(ctx, Number(params[0]) || 1, messageId, lang);
      case "stockcount_approve": return this.approveStockCount(ctx, params[0], messageId, lang);
      case "stockcount_approve_confirm": return this.confirmApproveStockCount(ctx, params[0], messageId, lang);
      case "due_page": return this.paginateDue(ctx, Number(params[0]) || 1, messageId, lang);
      case "menu": return this.sendMenu(ctx, lang, messageId);
      case "help": return this.sendHelp(ctx, lang);
      default:
        await TelegramService.sendMessage(ctx.chatId, this.t("unknownAction", lang));
    }
  },

  // --- i18n ---
  t(key: string, lang: string = "en"): string {
    const en: Record<string, string> = {
      welcome: "🚀 Welcome to Z-CRM Bot! You are connected to the <b>{group}</b> group with role <b>{role}</b>.",
      select: "Select an action:",
      unauthorized: "⛔ You are not authorized to use this bot in this group.",
      unknownCommand: "❓ Unknown command. Send /help to see available commands.",
      unknownAction: "❓ Unknown action.",
      noPermission: "⛔ You don't have permission for this action.",
      confirm: "⚠️ Please confirm:",
      yes: "✅ Confirm",
      no: "❌ Cancel",
      done: "✅ Done",
      cancelled: "❌ Cancelled",
      noData: "📭 No records found.",
      page: "Page {p} of {t}",
    };
    const bn: Record<string, string> = {
      welcome: "🚀 জেড-সিআরএম বটে স্বাগতম! আপনি <b>{group}</b> গ্রুপে <b>{role}</b> ভূমিকায় যুক্ত।",
      select: "একটি কর্ম নির্বাচন করুন:",
      unauthorized: "⛔ আপনার এই গ্রুপে বট ব্যবহারর অনুমতি নেই।",
      unknownCommand: "❓ অজানা কমান্ড। /help পাঠান।",
      unknownAction: "❓ অজানা কর্ম।",
      noPermission: "⛔ আপনার এই কর্মের অনুমতি নেই।",
      confirm: "⚠️ অনুগ্রহ করে নিশ্চিত করুন:",
      yes: "✅ নিশ্চিত",
      no: "❌ বাতিল",
      done: "✅ সম্পন্ন",
      cancelled: "❌ বাতিল করা হয়েছে",
      noData: "📭 কোনো তথ্য পাওয়া যায়নি।",
      page: "পৃষ্ঠা {p} / {t}",
    };
    return (lang === "bn" ? bn : en)[key] ?? key;
  },

  // --- Start / Menu ---
  async sendStart(ctx: CommandContext, lang: string) {
    const text = this.t("welcome", lang).replace("{group}", ctx.group.chatTitle).replace("{role}", ctx.roleName) + "\n\n" + this.t("select", lang);
    await TelegramService.sendMessage(ctx.chatId, text, this.menuKeyboard(ctx, lang));
  },
  async sendMenu(ctx: CommandContext, lang: string, messageId?: number) {
    const text = this.t("select", lang);
    const kb = this.menuKeyboard(ctx, lang);
    if (messageId) await TelegramService.editMessage(ctx.chatId, messageId, text, kb);
    else await TelegramService.sendMessage(ctx.chatId, text, kb);
  },

  menuKeyboard(ctx: CommandContext, lang: string) {
    const btn = (label: string, data: string) => ({ text: label, callback_data: data });
    const perms = ctx.permissions;
    const isAdmin = ctx.roleName === "SUPER_ADMIN" || ctx.roleName === "ADMIN";
    const rows: any[][] = [];
    const can = (p: string) => isAdmin || perms.includes(p);
    if (can("orders:read")) rows.push([btn("📦 Orders", "orders_page:1"), btn("🚚 Deliveries", "menu")]);
    if (can("customers:read")) rows.push([btn("👥 Customers", "customers_page:1"), btn("💸 Due", "due_page:1")]);
    if (can("inventory:read")) rows.push([btn("📊 Inventory", "inventory_page:1"), btn("🔄 Movements", "menu")]);
    if (can("payments:read")) rows.push([btn("💰 Payments", "payments_page:1")]);
    if (can("leads:read")) rows.push([btn("🎯 Leads", "leads_page:1")]);
    if (can("stock_counts:read")) rows.push([btn("📋 Stock Count", "stockcount_page:1")]);
    if (can("reports:read")) rows.push([btn("📈 Reports", "menu")]);
    rows.push([btn("❓ Help", "help")]);
    return { inline_keyboard: rows };
  },

  async sendHelp(ctx: CommandContext, lang: string) {
    const perms = ctx.permissions;
    const isAdmin = ctx.roleName === "SUPER_ADMIN" || ctx.roleName === "ADMIN";
    const can = (p: string) => isAdmin || perms.includes(p);
    const cmds: string[] = ["/start", "/help"];
    if (can("orders:read")) cmds.push("/orders — recent orders");
    if (can("customers:read")) cmds.push("/customers — customer list");
    if (can("inventory:read")) cmds.push("/inventory — stock levels");
    if (can("payments:read")) cmds.push("/payments — recent payments");
    if (can("leads:read")) cmds.push("/leads — Meta leads");
    if (can("customers:read")) cmds.push("/due — customers with outstanding dues");
    if (can("reports:read")) cmds.push("/reports — P&L summary");
    if (can("reports:read")) cmds.push("/cash — cash register summary");
    if (can("stock_counts:read")) cmds.push("/stockcount — stock counts");
    if (can("inventory:read")) cmds.push("/movements — stock movements");
    const text = `<b>Z-CRM Bot Commands</b>\n\nRole: <b>${ctx.roleName}</b>\nGroup: ${ctx.group.chatTitle}\n\n${cmds.map((c) => "• " + c).join("\n")}`;
    await TelegramService.sendMessage(ctx.chatId, text);
  },

  // --- Commands (each checks permission, calls CRM service, renders inline keyboard) ---

  async cmdOrders(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "orders:read")) return this.deny(ctx, lang);
    await this.paginateOrders(ctx, 1, undefined, lang);
  },
  async paginateOrders(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "orders:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.order.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 5, take: 5, include: { customer: { select: { name: true, phone: true } }, channel: { select: { name: true } } } }),
      db.order.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>📦 Orders</b> (${total})\n\n` + items.map((o) => `<b>${o.orderNumber}</b> · ${o.customer.name} · ${money(o.total.toFixed(2))} · ${o.status}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((o) => [{ text: `#${o.orderNumber} · ${o.customer.name}`, callback_data: `order_view:${o.id}` }]);
    rows.push(this.paginationRow(page, totalPages, "orders_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },

  async viewOrder(ctx: CommandContext, orderId: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "orders:read")) return this.deny(ctx, lang);
    const o = await db.order.findUnique({ where: { id: orderId }, include: { customer: true, channel: true, items: true, payments: true } });
    if (!o) return TelegramService.sendMessage(ctx.chatId, "Order not found");
    const profit = toDecimal(o.total).minus(o.items.reduce((s, it) => s.add(toDecimal(it.unitCost).times(toDecimal(it.quantity))), new (await import("@prisma/client")).Prisma.Decimal(0)));
    const text = `<b>${o.orderNumber}</b>\n👤 ${o.customer.name} · ${o.customer.phone}\n📦 ${o.items.length} items\n💵 Total: ${money(o.total.toFixed(2))}\n✅ Paid: ${money(o.paidAmount.toFixed(2))}\n📊 Status: ${o.status}\n💰 Profit: ${money(profit.toFixed(2))}\n🔗 Channel: ${o.channel.name}`;
    const rows: any[][] = [];
    if (this.can(ctx, "orders:update")) {
      rows.push([{ text: "✅ Confirm", callback_data: `order_status_confirm:${o.id}|CONFIRMED` }, { text: "🚚 Ship", callback_data: `order_status_confirm:${o.id}|SHIPPED` }]);
      rows.push([{ text: "📦 Deliver", callback_data: `order_status_confirm:${o.id}|DELIVERED` }, { text: "❌ Cancel", callback_data: `order_status_confirm:${o.id}|CANCELLED` }]);
    }
    if (this.can(ctx, "payments:create")) {
      rows.push([{ text: "💳 Pay", callback_data: `order_pay:${o.id}` }]);
    }
    rows.push([{ text: "⬅️ Back", callback_data: "orders_page:1" }]);
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },

  async confirmOrderStatus(ctx: CommandContext, orderId: string, status: string, messageId: number | undefined, lang: string) {
    // Show confirmation prompt
    const text = `${this.t("confirm", lang)}\n\nSet order <b>${orderId.slice(-6)}</b> to <b>${status}</b>?`;
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: `order_status:${orderId}|${status}` },
      { text: this.t("no", lang), callback_data: `order_view:${orderId}` },
    ]] };
    await this.sendOrEdit(ctx, text, kb, messageId);
  },
  async setOrderStatus(ctx: CommandContext, orderId: string, status: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "orders:update")) return this.deny(ctx, lang);
    try {
      await OrderService.updateStatus(orderId, status, `Updated via Telegram by ${ctx.user?.firstName ?? ctx.telegramUserId}`);
      await this.sendOrEdit(ctx, `${this.t("done", lang)} Order set to <b>${status}</b>.`, undefined, messageId);
      // Route notification
      await TelegramService.routeNotification("DELIVERY_UPDATE", `📦 Order status updated: ${status}`);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  async payOrderPrompt(ctx: CommandContext, orderId: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "payments:create")) return this.deny(ctx, lang);
    const o = await db.order.findUnique({ where: { id: orderId } });
    if (!o) return;
    const outstanding = toDecimal(o.total).minus(toDecimal(o.paidAmount));
    if (outstanding.lte(0)) return this.sendOrEdit(ctx, "✅ Order is fully paid.", undefined, messageId);
    // For simplicity, prompt full payment with confirmation
    const text = `${this.t("confirm", lang)}\n\nRecord full payment of <b>${money(outstanding.toFixed(2))}</b> for order <b>${o.orderNumber}</b>?\nMethod: CASH`;
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: `order_pay_confirm:${orderId}|${outstanding.toFixed(2)}` },
      { text: this.t("no", lang), callback_data: `order_view:${orderId}` },
    ]] };
    await this.sendOrEdit(ctx, text, kb, messageId);
  },

  // NOTE: was previously missing from handleCallbackData's switch — the
  // "✅ Confirm" button on payOrderPrompt sent this callback_data but
  // nothing handled it, so tapping it just showed "❓ Unknown action."
  // and no payment was ever recorded. PaymentService was imported but
  // never called.
  async confirmPayOrder(ctx: CommandContext, orderId: string, amountStr: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "payments:create")) return this.deny(ctx, lang);
    try {
      const payment = await PaymentService.create({
        orderId,
        amount: amountStr,
        method: "CASH",
        notes: `Recorded via Telegram by ${ctx.user?.firstName ?? ctx.telegramUserId}`,
      });
      await this.sendOrEdit(ctx, `${this.t("done", lang)} Payment of <b>${money(toDecimal(payment.amount).toFixed(2))}</b> recorded.`, undefined, messageId);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  async cmdCustomers(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "customers:read")) return this.deny(ctx, lang);
    await this.paginateCustomers(ctx, 1, undefined, lang);
  },
  async paginateCustomers(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "customers:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.customer.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 5, take: 5, select: { id: true, name: true, phone: true } }),
      db.customer.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>👥 Customers</b> (${total})\n\n` + items.map((c) => `• ${c.name} · ${c.phone}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((c) => [{ text: `👤 ${c.name}`, callback_data: `customer_view:${c.id}` }]);
    rows.push(this.paginationRow(page, totalPages, "customers_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },

  async viewCustomer(ctx: CommandContext, customerId: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "customers:read")) return this.deny(ctx, lang);
    const c = await db.customer.findUnique({ where: { id: customerId }, include: { _count: { select: { orders: true } } } });
    if (!c) return TelegramService.sendMessage(ctx.chatId, "Customer not found");
    const orderAgg = await db.order.aggregate({ where: { customerId: c.id, status: { not: "CANCELLED" } }, _sum: { total: true, paidAmount: true } });
    const due = toDecimal(orderAgg._sum.total ?? 0).minus(toDecimal(orderAgg._sum.paidAmount ?? 0));
    const text = `<b>${c.name}</b>\n📞 ${c.phone}\n📧 ${c.email ?? "—"}\n🏙️ ${c.city ?? "—"}\n📦 Orders: ${c._count.orders}\n💵 Total: ${money((orderAgg._sum.total ?? 0).toFixed(2))}\n💸 Due: ${money(due.toFixed(2))}`;
    const rows: any[][] = [[{ text: "⬅️ Back", callback_data: "customers_page:1" }]];
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },

  async cmdInventory(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "inventory:read")) return this.deny(ctx, lang);
    await this.paginateInventory(ctx, 1, undefined, lang);
  },
  async paginateInventory(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "inventory:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.inventory.findMany({ orderBy: { updatedAt: "desc" }, skip: (page - 1) * 5, take: 5, include: { product: { select: { name: true, sku: true, purchasePrice: true } } } }),
      db.inventory.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>📊 Inventory</b> (${total})\n\n` + items.map((i) => `• ${i.product.name} (${i.product.sku}): ${i.quantity} avail`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((i) => [{ text: `📦 ${i.product.name}: ${i.quantity}`, callback_data: `stock_adjust:${i.productId}` }]);
    rows.push(this.paginationRow(page, totalPages, "inventory_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },

  async stockAdjustPrompt(ctx: CommandContext, productId: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "inventory:adjust")) return this.deny(ctx, lang);
    const inv = await db.inventory.findUnique({ where: { productId }, include: { product: { select: { name: true, sku: true } } } });
    if (!inv) return;
    const text = `<b>${inv.product.name}</b> (${inv.product.sku})\nCurrent stock: <b>${inv.quantity}</b>\n\nQuick adjust:`;
    const kb = { inline_keyboard: [
      [{ text: "➖ −1", callback_data: `stock_adjust_confirm:${productId}|-1` }, { text: "➕ +1", callback_data: `stock_adjust_confirm:${productId}|1` }],
      [{ text: "➖ −5", callback_data: `stock_adjust_confirm:${productId}|-5` }, { text: "➕ +5", callback_data: `stock_adjust_confirm:${productId}|5` }],
      [{ text: "⬅️ Back", callback_data: "inventory_page:1" }],
    ] };
    await this.sendOrEdit(ctx, text, kb, messageId);
  },
  async confirmStockAdjust(ctx: CommandContext, productId: string, changeStr: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "inventory:adjust")) return this.deny(ctx, lang);
    try {
      const result = await InventoryService.applyMovement({ productId, type: "ADJUSTMENT", quantityChange: Number(changeStr), reason: `Telegram adjust by ${ctx.user?.firstName ?? ctx.telegramUserId}` });
      const inv = result.inventory;
      await this.sendOrEdit(ctx, `${this.t("done", lang)} Stock adjusted by ${changeStr}. New quantity: <b>${inv.quantity}</b>`, undefined, messageId);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  async cmdPayments(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "payments:read")) return this.deny(ctx, lang);
    await this.paginatePayments(ctx, 1, undefined, lang);
  },
  async paginatePayments(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "payments:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.payment.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 5, take: 5, include: { order: { select: { orderNumber: true } }, customer: { select: { name: true } } } }),
      db.payment.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>💰 Payments</b> (${total})\n\n` + items.map((p) => `• ${p.order.orderNumber}: ${money(p.amount.toFixed(2))} via ${p.method}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = [this.paginationRow(page, totalPages, "payments_page")];
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },

  async cmdLeads(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "leads:read")) return this.deny(ctx, lang);
    await this.paginateLeads(ctx, 1, undefined, lang);
  },
  async paginateLeads(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "leads:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.metaLead.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 5, take: 5, select: { id: true, name: true, phone: true, status: true, campaign: true } }),
      db.metaLead.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>🎯 Leads</b> (${total})\n\n` + items.map((l) => `• ${l.name} · ${l.phone ?? "—"} · ${l.status}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((l) => [{ text: `👤 ${l.name} · ${l.status}`, callback_data: `lead_view:${l.id}` }]);
    if (this.can(ctx, "leads:update")) {
      rows.push(...items.map((l) => [{ text: `🔄 Convert ${l.name.split(" ")[0]}`, callback_data: `lead_convert_confirm:${l.id}` }]));
    }
    rows.push(this.paginationRow(page, totalPages, "leads_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },

  // NOTE: was previously missing from handleCallbackData's switch — tapping
  // a lead row in /leads sent "lead_view:<id>" but nothing handled it, so
  // every tap just showed "❓ Unknown action."
  async viewLead(ctx: CommandContext, leadId: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "leads:read")) return this.deny(ctx, lang);
    const lead = await db.metaLead.findUnique({ where: { id: leadId } });
    if (!lead) return TelegramService.sendMessage(ctx.chatId, "Lead not found");
    const text = `<b>🎯 ${lead.name}</b>\n📞 ${lead.phone ?? "—"}\n📣 Campaign: ${lead.campaign ?? "—"}\n📊 Status: ${lead.status}`;
    const rows: any[][] = [];
    if (this.can(ctx, "leads:update") && lead.status !== "CONVERTED") {
      rows.push([{ text: "🔄 Convert to Customer", callback_data: `lead_convert_confirm:${lead.id}` }]);
    }
    rows.push([{ text: "⬅️ Back", callback_data: "leads_page:1" }]);
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },

  async confirmConvertLead(ctx: CommandContext, leadId: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "leads:update")) return this.deny(ctx, lang);
    const lead = await db.metaLead.findUnique({ where: { id: leadId } });
    if (!lead) return;
    const text = `${this.t("confirm", lang)}\n\nConvert lead <b>${lead.name}</b> to a customer?`;
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: `lead_convert:${leadId}` },
      { text: this.t("no", lang), callback_data: "leads_page:1" },
    ]] };
    await this.sendOrEdit(ctx, text, kb, messageId);
  },
  async convertLead(ctx: CommandContext, leadId: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "leads:update")) return this.deny(ctx, lang);
    try {
      const customerId = await LeadService.convertToCustomer(leadId);
      await this.sendOrEdit(ctx, `${this.t("done", lang)} Lead converted to customer.`, undefined, messageId);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  async cmdDue(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "customers:read")) return this.deny(ctx, lang);
    await this.paginateDue(ctx, 1, undefined, lang);
  },
  async paginateDue(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "customers:read")) return this.deny(ctx, lang);
    const customers = await db.customer.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 5, take: 5 });
    const dues = await Promise.all(customers.map(async (c) => {
      const o = await db.order.aggregate({ where: { customerId: c.id, status: { not: "CANCELLED" } }, _sum: { total: true, paidAmount: true } });
      const due = toDecimal(o._sum.total ?? 0).minus(toDecimal(o._sum.paidAmount ?? 0));
      return { id: c.id, name: c.name, due };
    }));
    const withDues = dues.filter((d) => d.due.gt(0));
    if (!withDues.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const text = `<b>💸 Customers with Dues</b>\n\n` + withDues.map((d) => `• ${d.name}: ${money(d.due.toFixed(2))}`).join("\n");
    const rows: any[][] = withDues.map((d) => [{ text: `💸 ${d.name}`, callback_data: `customer_view:${d.id}` }]);
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },

  async cmdStockCount(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "stock_counts:read")) return this.deny(ctx, lang);
    await this.paginateStockCounts(ctx, 1, undefined, lang);
  },
  async paginateStockCounts(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "stock_counts:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.stockCount.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 5, take: 5, include: { _count: { select: { items: true } } } }),
      db.stockCount.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const text = `<b>📋 Stock Counts</b> (${total})\n\n` + items.map((s) => `• ${s.countNumber}: ${s.status} · ${s._count.items} items`).join("\n");
    const rows: any[][] = [];
    if (this.can(ctx, "stock_counts:approve")) {
      rows.push(...items.filter((s) => s.status === "PENDING_APPROVAL").map((s) => [{ text: `✅ Approve ${s.countNumber}`, callback_data: `stockcount_approve_confirm:${s.id}` }]));
    }
    rows.push([this.paginationRow(page, Math.ceil(total / 5) || 1, "stockcount_page")[0]]);
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async approveStockCount(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    const sc = await db.stockCount.findUnique({ where: { id } });
    if (!sc) return;
    const text = `${this.t("confirm", lang)}\n\nApprove stock count <b>${sc.countNumber}</b>?\nThis will apply ADJUSTMENT movements to inventory.`;
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: `stockcount_approve:${id}` },
      { text: this.t("no", lang), callback_data: "stockcount_page:1" },
    ]] };
    await this.sendOrEdit(ctx, text, kb, messageId);
  },
  async confirmApproveStockCount(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "stock_counts:approve")) return this.deny(ctx, lang);
    try {
      await StockReconciliationService.approve(id);
      await this.sendOrEdit(ctx, `${this.t("done", lang)} Stock count approved. Adjustments applied.`, undefined, messageId);
      await TelegramService.routeNotification("STOCK_COUNT_APPROVAL", `✅ Stock count approved via Telegram`);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  async cmdReports(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "reports:read")) return this.deny(ctx, lang);
    const pnl = await AccountingService.profitAndLoss();
    const text = `<b>📈 P&L Summary</b>\n\nRevenue: ${money(pnl.revenue.toFixed(2))}\nCOGS: ${money(pnl.cogs.toFixed(2))}\nGross Profit: ${money(pnl.grossProfit.toFixed(2))}\nExpenses: ${money(pnl.operatingExpenses.toFixed(2))}\nNet Profit: ${money(pnl.netProfit.toFixed(2))}\nOrders: ${pnl.orderCount}`;
    await TelegramService.sendMessage(ctx.chatId, text);
  },

  async cmdCash(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "reports:read")) return this.deny(ctx, lang);
    const summary = await CashService.summary();
    const text = `<b>💰 Cash Register</b>\n\nOpening: ${summary.openingBalance}\n+ Cash Sales: ${summary.cashSales}\n+ Customer Payments: ${summary.customerPayments}\n− Refunds: ${summary.refunds}\n− Expenses: ${summary.expenses}\n= Closing: ${summary.closingBalance}`;
    await TelegramService.sendMessage(ctx.chatId, text);
  },

  // Stub commands for remaining modules (show summary)
  async cmdDeliveries(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "deliveries:read")) return this.deny(ctx, lang);
    const { DeliveryService } = await import("./delivery");
    const d = await DeliveryService.dashboard();
    const text = `<b>🚚 Deliveries</b>\nTotal: ${d.total} · Pending: ${d.pending} · Shipped: ${d.shipped} · Delivered: ${d.delivered}`;
    await TelegramService.sendMessage(ctx.chatId, text);
  },
  async cmdReturns(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "returns:read")) return this.deny(ctx, lang);
    const count = await db.return.count();
    await TelegramService.sendMessage(ctx.chatId, `<b>↩️ Returns</b>\nTotal: ${count}`);
  },
  async cmdPurchases(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "purchases:read")) return this.deny(ctx, lang);
    const count = await db.purchase.count();
    await TelegramService.sendMessage(ctx.chatId, `<b>🛒 Purchases</b>\nTotal: ${count}`);
  },
  async cmdSuppliers(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "suppliers:read")) return this.deny(ctx, lang);
    const count = await db.supplier.count();
    await TelegramService.sendMessage(ctx.chatId, `<b>🏭 Suppliers</b>\nTotal: ${count}`);
  },
  async cmdExpenses(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "expenses:read")) return this.deny(ctx, lang);
    const agg = await db.expense.aggregate({ _sum: { amount: true }, _count: true });
    await TelegramService.sendMessage(ctx.chatId, `<b>💸 Expenses</b>\nCount: ${agg._count} · Total: ${money((agg._sum.amount ?? 0).toFixed(2))}`);
  },
  async cmdProducts(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "products:read")) return this.deny(ctx, lang);
    const count = await db.product.count();
    await TelegramService.sendMessage(ctx.chatId, `<b>📦 Products</b>\nTotal: ${count}`);
  },
  async cmdStockMovements(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "inventory:read")) return this.deny(ctx, lang);
    const count = await db.stockMovement.count();
    await TelegramService.sendMessage(ctx.chatId, `<b>🔄 Stock Movements</b>\nTotal: ${count}`);
  },
  async cmdWarehouses(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "warehouses:read")) return this.deny(ctx, lang);
    const count = await db.warehouse.count();
    await TelegramService.sendMessage(ctx.chatId, `<b>🏪 Warehouses</b>\nTotal: ${count}`);
  },
  async cmdTransfers(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "stock_transfers:read")) return this.deny(ctx, lang);
    const count = await db.stockTransfer.count();
    await TelegramService.sendMessage(ctx.chatId, `<b>🔀 Stock Transfers</b>\nTotal: ${count}`);
  },
  async cmdInbox(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "conversations:read")) return this.deny(ctx, lang);
    const count = await db.conversation.count({ where: { status: "OPEN" } });
    await TelegramService.sendMessage(ctx.chatId, `<b>📥 Inbox</b>\nOpen conversations: ${count}`);
  },
  async cmdNotifications(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "notifications:read")) return this.deny(ctx, lang);
    const count = await db.notification.count({ where: { isRead: false } });
    await TelegramService.sendMessage(ctx.chatId, `<b>🔔 Notifications</b>\nUnread: ${count}`);
  },
  async cmdPipeline(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "pipelines:read")) return this.deny(ctx, lang);
    const { SalesPipelineService } = await import("./sales-pipeline");
    const p = await SalesPipelineService.pipeline();
    const text = `<b>📊 Sales Pipeline</b>\n` + Object.entries(p).map(([stage, s]) => `• ${stage}: ${(s as any).count} (${money((s as any).value)})`).join("\n");
    await TelegramService.sendMessage(ctx.chatId, text);
  },

  // --- helpers ---
  can(ctx: CommandContext, perm: string): boolean {
    if (ctx.roleName === "SUPER_ADMIN" || ctx.roleName === "ADMIN") return true;
    return ctx.permissions.includes(perm);
  },
  async deny(ctx: CommandContext, lang: string) {
    await TelegramService.sendMessage(ctx.chatId, this.t("noPermission", lang));
  },
  paginationRow(page: number, totalPages: number, prefix: string): any[] {
    const row: any[] = [];
    if (page > 1) row.push({ text: "⬅️", callback_data: `${prefix}:${page - 1}` });
    if (page < totalPages) row.push({ text: "➡️", callback_data: `${prefix}:${page + 1}` });
    return row.length ? row : [];
  },
  async sendOrEdit(ctx: CommandContext, text: string, keyboard: any, messageId: number | undefined) {
    if (messageId) await TelegramService.editMessage(ctx.chatId, messageId, text, keyboard);
    else await TelegramService.sendMessage(ctx.chatId, text, keyboard);
  },
};
