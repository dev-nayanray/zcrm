import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { TelegramService } from "./telegram";
import { OrderService } from "./order";
import { PaymentService } from "./payment";
import { TelegramSessionStore, type OrderDraft } from "./telegram-session";
import { ProfitabilityService } from "./profitability";
import { CustomerDueService } from "./customer-due";
import { InventoryService } from "./inventory";
import { StockReconciliationService } from "./stock-reconciliation";
import { AccountingService } from "./accounting";
import { CashService } from "./cash";
import { LeadService } from "./lead";
import { NotificationService } from "./notification";
import { Permission } from "@/lib/constants";
import { toDecimal } from "@/lib/decimal";
import { money, num } from "@/lib/api-client";
import { hashPassword } from "@/lib/auth";
import { AuditService } from "./audit";
import { SupplierService } from "./supplier";
import { PurchaseService } from "./purchase";
import { WarehouseService, StockTransferService } from "./warehouse";
import { CourierService } from "./courier";
import { AutomationService } from "./automation";
import { MessageTemplateService } from "./message-template";
import { BillingService } from "./billing";
import { DeliveryService } from "./delivery";
import { ReturnService } from "./return";
import { ConversationService } from "./conversation";
import { SalesPipelineService } from "./sales-pipeline";

const MANAGEABLE_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES", "INVENTORY", "ACCOUNTANT"] as const;

function generateTempPassword(): string {
  // 12-char alphanumeric, cryptographically random — shown once to the
  // admin who requested it, never logged or stored in plaintext.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

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

    // ── Multi-step flow text input interception ──
    // If the user has an active order draft session, capture their text
    // input for the current step (customer phone, product search, quantity,
    // shipping amount, etc.) instead of treating it as an unknown command.
    // The session is keyed by (telegramUserId, chatId) so user A's draft
    // can never be affected by user B's input.
    if (!command.startsWith("/") && !text.startsWith("/")) {
      const handled = await this.handleOrderDraftTextInput(ctx, text, lang);
      if (handled) {
        await TelegramService.logAction({ groupId: ctx.group.id, userId: ctx.user?.id, telegramUserId: fromId, action: "COMMAND", command: "draft_input", result: "ok" });
        return { ok: true, action: "draft_input" };
      }
    }

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
      "/users": this.cmdUsers, "/categories": this.cmdCategories, "/couriers": this.cmdCouriers,
      "/automation": this.cmdAutomation, "/templates": this.cmdTemplates, "/wallet": this.cmdWallet,
      "/auditlogs": this.cmdAuditLogs,
      // ── NEW: report variants (req'd by the user spec) ──
      "/salesreport": this.cmdSalesReport, "/profitreport": this.cmdProfitReport,
      "/expensereport": this.cmdExpenseReport, "/inventoryreport": this.cmdInventoryReport,
      "/paymentreport": this.cmdPaymentReport, "/orderreport": this.cmdOrderReport,
      "/purchasereport": this.cmdPurchaseReport,
      // ── NEW: refunds & supplier payments ──
      "/refunds": this.cmdRefunds,
      "/receivepayment": this.cmdReceivePayment,
      // ── NEW: low-stock & stock adjust shortcuts ──
      "/lowstock": this.cmdLowStock,
      "/stockadjust": this.cmdStockAdjustShortcut,
      // ── NEW: today / summary / dashboard ──
      "/today": this.cmdToday, "/summary": this.cmdSummary, "/dashboard": this.cmdDashboard,
      // ── NEW: /profit with date-range support ──
      "/profit": this.cmdProfit,
      "/cogs": this.cmdCogs,
      "/sales": this.cmdSales,
      "/duereport": this.cmdDueReport,
      // ── NEW: return + refund management ──
      "/approvereturn": this.cmdApproveReturn,
      "/refund": this.cmdRefund,
      "/receivepurchase": this.cmdReceivePurchase,
    };

    // Commands that take raw "|"-separated text after the command (not the
    // space-split args array every other command uses) — handled here.
    const rawTextCommands: Record<string, (ctx: CommandContext, raw: string, lang: string) => Promise<void>> = {
      "/adduser": this.cmdAddUser,
      "/addcategory": this.cmdAddCategory,
      "/addsupplier": this.cmdAddSupplier,
      "/addwarehouse": this.cmdAddWarehouse,
      "/addexpense": this.cmdAddExpense,
      "/addproduct": this.cmdAddProduct,
      "/transfer": this.cmdCreateTransfer,
      // ── NEW: create order from raw text ──
      "/createorder": this.cmdCreateOrder,
      "/updateorder": this.cmdUpdateOrder,
      "/cancelorder": this.cmdCancelOrder,
      "/returnorder": this.cmdReturnOrder,
      // ── NEW: customer / supplier / category / product updates ──
      "/addcustomer": this.cmdAddCustomer,
      "/updatecustomer": this.cmdUpdateCustomer,
      "/updateproduct": this.cmdUpdateProduct,
      "/updatecategory": this.cmdUpdateCategory,
      "/updatesupplier": this.cmdUpdateSupplier,
      // ── NEW: purchase creation (pipe-delimited) ──
      "/createpurchase": this.cmdCreatePurchase,
    };
    if (rawTextCommands[command]) {
      try {
        const raw = text.slice(command.length).trim();
        await rawTextCommands[command].call(this, ctx, raw, lang);
        await TelegramService.logAction({ groupId: ctx.group.id, userId: ctx.user?.id, telegramUserId: fromId, action: "COMMAND", command, result: "ok" });
        return { ok: true, action: command.slice(1) };
      } catch (e) {
        await TelegramService.sendMessage(chatId, `❌ ${(e as Error).message}`);
        return { ok: false, action: command.slice(1) };
      }
    }

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
          `• To enable two-step login verification for your account, go to CRM → Settings → Security → Connect Telegram, then send me the code shown there as:\n<code>/link YOUR_CODE</code>\n` +
          `• Once linked, I'll DM you here whenever your account logs in, logs out, or has a suspicious login attempt.\n` +
          `• Commands: /security (login history), /whoami (account info), /mute or /unmute (pause security DMs), /language en|bn.`,
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

    if (command === "/security" || command === "/status" || command === "/activity") {
      const linked = await db.telegramUser.findUnique({ where: { telegramId: fromId } });
      if (!linked?.crmUserId) {
        await TelegramService.sendMessage(chatId, "No linked CRM account found. Send <code>/link YOUR_CODE</code> to connect one first.");
        return { ok: true, action: "private_security_unlinked" };
      }
      const user = await db.user.findUnique({ where: { id: linked.crmUserId } });
      if (!user) {
        await TelegramService.sendMessage(chatId, "That CRM account no longer exists.");
        return { ok: true, action: "private_security_missing" };
      }
      const requested = Number(args[0]);
      const take = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 20) : 5;
      const recent = await db.auditLog.findMany({
        where: { userId: user.id, action: { in: ["LOGIN", "LOGOUT"] } },
        orderBy: { createdAt: "desc" },
        take,
      });
      const lines = recent.length
        ? recent.map((r) => `${r.action === "LOGIN" ? "🔓" : "🔒"} ${r.action} — ${r.ipAddress ?? "IP not recorded (older entry)"} · ${new Date(r.createdAt).toLocaleString()}`).join("\n")
        : "No recent activity.";
      await TelegramService.sendMessage(
        chatId,
        `🛡️ <b>Account security</b>\n\n` +
          `Account: <b>${user.name}</b> (${user.email})\n` +
          `Two-step verification: <b>${user.twoFactorEnabled ? "Enabled ✅" : "Disabled ⚠️"}</b>\n` +
          `Security DMs: <b>${user.securityNotifyMuted ? "Muted 🔕" : "On 🔔"}</b>\n\n` +
          `<b>Recent activity (last ${recent.length}):</b>\n${lines}\n\n` +
          `<i>Entries logged before this feature shipped won't show an IP — new logins always will.</i>\n\n` +
          `Send /security 15 for more, /mute to pause these DMs, or /unmute to resume.`,
      );
      return { ok: true, action: "private_security" };
    }

    if (command === "/mute" || command === "/unmute") {
      const linked = await db.telegramUser.findUnique({ where: { telegramId: fromId } });
      if (!linked?.crmUserId) {
        await TelegramService.sendMessage(chatId, "No linked CRM account found. Send <code>/link YOUR_CODE</code> to connect one first.");
        return { ok: true, action: "private_mute_unlinked" };
      }
      const muted = command === "/mute";
      await db.user.update({ where: { id: linked.crmUserId }, data: { securityNotifyMuted: muted } });
      await TelegramService.sendMessage(
        chatId,
        muted
          ? "🔕 Muted. You won't get login/logout/failed-attempt DMs anymore. Verification codes for 2FA will still be sent — those can't be muted."
          : "🔔 Unmuted. You'll get login/logout/failed-attempt DMs again.",
      );
      return { ok: true, action: command === "/mute" ? "private_mute" : "private_unmute" };
    }

    if (command === "/whoami") {
      const linked = await db.telegramUser.findUnique({ where: { telegramId: fromId }, include: { crmUser: { include: { role: true } } } });
      if (!linked?.crmUser) {
        await TelegramService.sendMessage(chatId, `Telegram ID: <code>${fromId}</code>\nNo CRM account linked yet. Send <code>/link YOUR_CODE</code>.`);
        return { ok: true, action: "private_whoami_unlinked" };
      }
      await TelegramService.sendMessage(
        chatId,
        `👤 <b>${linked.crmUser.name}</b>\n${linked.crmUser.email}\nRole: ${linked.crmUser.role.name}\nTelegram ID: <code>${fromId}</code>\nLanguage: ${linked.language ?? "en"}`,
      );
      return { ok: true, action: "private_whoami" };
    }

    if (command === "/language") {
      const choice = args[0]?.toLowerCase();
      if (choice !== "en" && choice !== "bn") {
        await TelegramService.sendMessage(chatId, "Usage: <code>/language en</code> or <code>/language bn</code>");
        return { ok: true, action: "private_language_usage" };
      }
      await TelegramService.upsertUser(fromId, { language: choice });
      await TelegramService.sendMessage(chatId, choice === "bn" ? "✅ ভাষা বাংলা করা হয়েছে।" : "✅ Language set to English.");
      return { ok: true, action: "private_language" };
    }

    await TelegramService.sendMessage(
      chatId,
      "❓ Send /start for an overview, /link YOUR_CODE to connect your account, /security to check login activity, /whoami for your account, /mute or /unmute to control security DMs, or /language en|bn.",
    );
    return { ok: true, action: "private_unknown" };
  },

  async handleCallback(cb: any): Promise<{ ok: boolean; action: string }> {
    const chatId = String(cb.message?.chat?.id);
    const fromId = String(cb.from.id);
    const data = cb.data ?? "";
    const messageId = cb.message?.message_id;

    await TelegramService.answerCallbackQuery(cb.id);

    // 2FA tap-to-approve/deny lives in the user's private chat with the
    // bot, NOT a TelegramGroup — it must NOT go through resolveContext()
    // (which requires group membership). Handled first, independently.
    if (data.startsWith("2fa_decide:")) {
      const [, challengeId, decision] = data.split(":");
      const { TwoFactorService } = await import("./two-factor");
      const result = await TwoFactorService.decideChallenge(challengeId, fromId, decision as "APPROVED" | "DENIED");
      await TelegramService.sendMessage(chatId, result.message);
      if (messageId) {
        // Remove the buttons once a decision has been made so it can't be tapped twice.
        await TelegramService.editMessage(chatId, messageId, `${result.ok ? "✅" : "❌"} ${result.message}`, { inline_keyboard: [] });
      }
      return { ok: result.ok, action: "2fa_decide" };
    }

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
      case "users_page": return this.paginateUsers(ctx, Number(params[0]) || 1, messageId, lang);
      case "user_view": return this.viewUser(ctx, params[0], messageId, lang);
      case "user_role_menu": return this.userRoleMenu(ctx, params[0], messageId, lang);
      case "user_role_set": return this.confirmUserRolePrompt(ctx, params[0], params[1], messageId, lang);
      case "user_role_set_confirm": return this.confirmUserRole(ctx, params[0], params[1], messageId, lang);
      case "user_toggle": return this.confirmUserTogglePrompt(ctx, params[0], messageId, lang);
      case "user_toggle_confirm": return this.confirmUserToggle(ctx, params[0], params[1], messageId, lang);
      case "user_resetpw": return this.confirmUserResetPwPrompt(ctx, params[0], messageId, lang);
      case "user_resetpw_confirm": return this.confirmUserResetPw(ctx, params[0], messageId, lang);
      case "menu": return this.sendMenu(ctx, lang, messageId);
      case "help": return this.sendHelp(ctx, lang);

      case "suppliers_page": return this.paginateSuppliers(ctx, Number(params[0]) || 1, messageId, lang);
      case "supplier_view": return this.viewSupplier(ctx, params[0], messageId, lang);

      case "purchases_page": return this.paginatePurchases(ctx, Number(params[0]) || 1, messageId, lang);
      case "purchase_view": return this.viewPurchase(ctx, params[0], messageId, lang);
      case "purchase_receive": return this.receivePurchasePrompt(ctx, params[0], messageId, lang);
      case "purchase_receive_confirm": return this.confirmReceivePurchase(ctx, params[0], messageId, lang);

      case "warehouses_page": return this.paginateWarehouses(ctx, Number(params[0]) || 1, messageId, lang);
      case "warehouse_view": return this.viewWarehouse(ctx, params[0], messageId, lang);
      case "warehouse_toggle": return this.confirmWarehouseTogglePrompt(ctx, params[0], messageId, lang);
      case "warehouse_toggle_confirm": return this.confirmWarehouseToggle(ctx, params[0], params[1], messageId, lang);

      case "transfers_page": return this.paginateTransfers(ctx, Number(params[0]) || 1, messageId, lang);
      case "transfer_view": return this.viewTransfer(ctx, params[0], messageId, lang);

      case "categories_page": return this.paginateCategories(ctx, Number(params[0]) || 1, messageId, lang);

      case "expenses_page": return this.paginateExpenses(ctx, Number(params[0]) || 1, messageId, lang);

      case "products_page": return this.paginateProducts(ctx, Number(params[0]) || 1, messageId, lang);
      case "product_view": return this.viewProduct(ctx, params[0], messageId, lang);

      case "movements_page": return this.paginateStockMovements(ctx, Number(params[0]) || 1, messageId, lang);

      case "deliveries_page": return this.paginateDeliveries(ctx, Number(params[0]) || 1, messageId, lang);
      case "delivery_view": return this.viewDelivery(ctx, params[0], messageId, lang);
      case "delivery_status_menu": return this.deliveryStatusMenu(ctx, params[0], messageId, lang);
      case "delivery_status_set": return this.confirmDeliveryStatusPrompt(ctx, params[0], params[1], messageId, lang);
      case "delivery_status_confirm": return this.confirmDeliveryStatus(ctx, params[0], params[1], messageId, lang);

      case "returns_page": return this.paginateReturns(ctx, Number(params[0]) || 1, messageId, lang);
      case "return_view": return this.viewReturn(ctx, params[0], messageId, lang);

      case "inbox_page": return this.paginateInbox(ctx, Number(params[0]) || 1, messageId, lang);
      case "conversation_view": return this.viewConversation(ctx, params[0], messageId, lang);

      case "notifications_page": return this.paginateNotifications(ctx, Number(params[0]) || 1, messageId, lang);
      case "notif_mark_all": return this.confirmMarkAllNotificationsPrompt(ctx, messageId, lang);
      case "notif_mark_all_confirm": return this.confirmMarkAllNotifications(ctx, messageId, lang);

      case "pipeline_page": return this.paginatePipeline(ctx, Number(params[0]) || 1, messageId, lang);
      case "pipeline_view": return this.viewPipelineEntry(ctx, params[0], messageId, lang);
      case "pipeline_stage_menu": return this.pipelineStageMenu(ctx, params[0], messageId, lang);
      case "pipeline_stage_set": return this.confirmPipelineStagePrompt(ctx, params[0], params[1], messageId, lang);
      case "pipeline_stage_confirm": return this.confirmPipelineStage(ctx, params[0], params[1], messageId, lang);

      case "couriers_page": return this.paginateCouriers(ctx, Number(params[0]) || 1, messageId, lang);
      case "courier_toggle": return this.confirmCourierTogglePrompt(ctx, params[0], messageId, lang);
      case "courier_toggle_confirm": return this.confirmCourierToggle(ctx, params[0], params[1], messageId, lang);

      case "automation_page": return this.paginateAutomation(ctx, Number(params[0]) || 1, messageId, lang);
      case "automation_toggle": return this.confirmAutomationTogglePrompt(ctx, params[0], messageId, lang);
      case "automation_toggle_confirm": return this.confirmAutomationToggle(ctx, params[0], params[1], messageId, lang);

      case "templates_page": return this.paginateTemplates(ctx, Number(params[0]) || 1, messageId, lang);
      case "template_view": return this.viewTemplate(ctx, params[0], messageId, lang);

      case "auditlogs_page": return this.paginateAuditLogs(ctx, Number(params[0]) || 1, messageId, lang);

      // ── NEW: reports menu callback — opens a list of report types ──
      case "reports_menu": return this.reportsMenu(ctx, messageId, lang);
      case "reports_view": return this.viewReport(ctx, params[0] || "profit-loss", messageId, lang);

      // ── NEW: interactive /createorder multi-step flow ──
      case "od_search_customer": return this.odSearchCustomer(ctx, messageId, lang);
      case "od_select_customer": return this.odSelectCustomer(ctx, params[0], messageId, lang);
      case "od_new_customer": return this.odNewCustomerPrompt(ctx, messageId, lang);
      case "od_search_product": return this.odSearchProduct(ctx, messageId, lang);
      case "od_select_product": return this.odSelectProduct(ctx, params[0], messageId, lang);
      case "od_select_variation": return this.odSelectVariation(ctx, params[0], messageId, lang);
      case "od_set_qty": return this.odSetQty(ctx, params[0], messageId, lang);
      case "od_add_more": return this.odAddMore(ctx, params[0], messageId, lang);
      case "od_set_shipping": return this.odSetShipping(ctx, messageId, lang);
      case "od_set_discount": return this.odSetDiscount(ctx, messageId, lang);
      case "od_set_payment_method": return this.odSetPaymentMethod(ctx, params[0], messageId, lang);
      case "od_set_payment_amount": return this.odSetPaymentAmount(ctx, messageId, lang);
      case "od_show_summary": return this.odShowSummary(ctx, messageId, lang);
      case "od_confirm": return this.odConfirm(ctx, messageId, lang);
      case "od_cancel": return this.odCancel(ctx, messageId, lang);
      case "od_remove_item": return this.odRemoveItem(ctx, params[0], messageId, lang);

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
    if (can("orders:read")) rows.push([btn("📦 Orders", "orders_page:1"), btn("🚚 Deliveries", "deliveries_page:1")]);
    if (can("customers:read")) rows.push([btn("👥 Customers", "customers_page:1"), btn("💸 Due", "due_page:1")]);
    if (can("inventory:read")) rows.push([btn("📊 Inventory", "inventory_page:1"), btn("🔄 Movements", "movements_page:1")]);
    if (can("payments:read")) rows.push([btn("💰 Payments", "payments_page:1")]);
    if (can("leads:read")) rows.push([btn("🎯 Leads", "leads_page:1")]);
    if (can("stock_counts:read")) rows.push([btn("📋 Stock Count", "stockcount_page:1")]);
    if (can("reports:read")) rows.push([btn("📈 Reports", "reports_menu")]);
    if (can("users:read")) rows.push([btn("🧑‍💼 Users", "users_page:1")]);
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
    if (can("users:read")) cmds.push("/users — manage CRM users (role, status, password)");
    if (can("users:create")) cmds.push("/adduser Name | email | ROLE | phone — create a user");
    if (can("inventory:read")) cmds.push("/inventory — stock levels");
    if (can("payments:read")) cmds.push("/payments — recent payments");
    if (can("leads:read")) cmds.push("/leads — Meta leads");
    if (can("customers:read")) cmds.push("/due — customers with outstanding dues");
    if (can("reports:read")) cmds.push("/reports — P&L summary");
    if (can("reports:read")) cmds.push("/cash — cash register summary");
    if (can("stock_counts:read")) cmds.push("/stockcount — stock counts");
    if (can("inventory:read")) cmds.push("/movements — stock movements");
    if (can("deliveries:read")) cmds.push("/deliveries — deliveries (update status)");
    if (can("returns:read")) cmds.push("/returns — returns");
    if (can("purchases:read")) cmds.push("/purchases — purchases (mark received)");
    if (can("suppliers:read")) cmds.push("/suppliers — suppliers");
    if (can("suppliers:create")) cmds.push("/addsupplier Name | phone | email | address — add a supplier");
    if (can("expenses:read")) cmds.push("/expenses — expenses");
    if (can("expenses:create")) cmds.push("/addexpense Category | Amount | Method | Note — record an expense");
    if (can("products:read")) cmds.push("/products — products");
    if (can("products:create")) cmds.push("/addproduct Name | SKU | SellingPrice | PurchasePrice | Category — add a product");
    if (can("categories:read")) cmds.push("/categories — product categories");
    if (can("categories:create")) cmds.push("/addcategory Name | description — add a category");
    if (can("warehouses:read")) cmds.push("/warehouses — warehouses (activate/deactivate)");
    if (can("warehouses:create")) cmds.push("/addwarehouse Name | Code | Address — add a warehouse");
    if (can("stock_transfers:read")) cmds.push("/transfers — stock transfers");
    if (can("stock_transfers:create")) cmds.push("/transfer FROM_CODE | TO_CODE | SKU | QTY — move stock between warehouses");
    if (can("conversations:read")) cmds.push("/inbox — open conversations");
    if (can("notifications:read")) cmds.push("/notifications — unread notifications (mark all read)");
    if (can("pipelines:read")) cmds.push("/pipeline — sales pipeline (move stage)");
    if (can("deliveries:read")) cmds.push("/couriers — courier providers (activate/deactivate)");
    if (can("automation:read")) cmds.push("/automation — automation rules (enable/disable)");
    if (can("message_templates:read")) cmds.push("/templates — message templates");
    if (can("billing:read")) cmds.push("/wallet — your billing & wallet summary");
    if (can("audit_logs:read")) cmds.push("/auditlogs — recent audit log activity");
    // NEW commands
    if (can("dashboard:read") || can("reports:read")) cmds.push("/today /summary /dashboard — today's KPIs");
    if (can("orders:create")) cmds.push("/createorder PHONE | SKU:QTY,SKU:QTY | METHOD | SHIPPING — create an order");
    if (can("orders:update")) cmds.push("/updateorder ORDER_ID | STATUS — change order status");
    if (can("orders:cancel")) cmds.push("/cancelorder ORDER_ID — cancel order & restore stock");
    if (can("returns:create")) cmds.push("/returnorder ORDER_ID | TYPE? | REASON? — start a return");
    if (can("payments:create")) cmds.push("/receivepayment ORDER_ID | AMOUNT | METHOD | REF? — record payment");
    if (can("inventory:read")) cmds.push("/lowstock — low/out-of-stock items");
    if (can("inventory:adjust")) cmds.push("/stockadjust PRODUCT_ID | NEW_QTY | REASON? — set stock");
    if (can("refunds:read")) cmds.push("/refunds — recent refunds");
    if (can("reports:read")) cmds.push("/salesreport /profitreport /expensereport /inventoryreport /paymentreport /orderreport /purchasereport — quick reports");
    // NEW Phase 2 accounting commands
    if (can("reports:read") || can("dashboard:read")) cmds.push("/profit today|week|month|YYYY-MM-DD YYYY-MM-DD — P&L with date filter");
    if (can("reports:read") || can("dashboard:read")) cmds.push("/sales — sales report (default: this month)");
    if (can("reports:read") || can("dashboard:read")) cmds.push("/cogs — COGS + gross margin (default: this month)");
    if (can("reports:read") || can("customers:read")) cmds.push("/duereport — customer due aging buckets");
    // NEW Phase 3 commands
    if (can("customers:create")) cmds.push("/addcustomer Name | Phone | Email? | City? — add customer");
    if (can("customers:update")) cmds.push("/updatecustomer ID | Name? | Phone? | Email? | City? — update customer");
    if (can("products:update")) cmds.push("/updateproduct ID | SellingPrice? | PurchasePrice? | Status? — update product (pushes to Woo)");
    if (can("categories:update")) cmds.push("/updatecategory ID | Name? | Description? — update category");
    if (can("suppliers:update")) cmds.push("/updatesupplier ID | Name? | Phone? | Email? | Address? — update supplier");
    if (can("purchases:create")) cmds.push("/createpurchase SupplierID | SKU:QTY:COST,... | Paid? | Shipping? — create + receive purchase");
    if (can("purchases:update")) cmds.push("/receivepurchase PurchaseID — receive pending purchase");
    if (can("returns:update")) cmds.push("/approvereturn RETURN_ID — approve pending return (applies stock + refund)");
    if (can("payments:refund")) cmds.push("/refund ORDER_ID | AMOUNT | METHOD? | REF? — record refund");
    if (can("stock_transfers:read")) cmds.push("/transfers — list stock transfers");
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
    const o = await db.order.findUnique({ where: { id: orderId }, include: { customer: true, channel: true, items: true, payments: true, delivery: true, expenses: true, refunds: true } });
    if (!o) return TelegramService.sendMessage(ctx.chatId, "Order not found");

    // Use ProfitabilityService for the canonical financial breakdown —
    // NOT inline arithmetic that could drift from the dashboard.
    const snap = await ProfitabilityService.computeOrderSnapshot(orderId);
    const margin = snap.totalSales.gt(0) ? snap.netProfit.dividedBy(snap.totalSales).times(100) : new Prisma.Decimal(0);
    const due = toDecimal(o.total).minus(toDecimal(o.paidAmount));

    const itemsText = o.items.map((it) => `• ${it.productName} (${it.sku}) × ${it.quantity} @ ${money(Number(it.unitPrice).toFixed(2))} = ${money(Number(it.total).toFixed(2))}`).join("\n");

    const text =
      `<b>📦 ${o.orderNumber}</b>\n\n` +
      `👤 <b>Customer:</b> ${o.customer.name}\n` +
      `📞 <b>Phone:</b> ${o.customer.phone}\n` +
      `🔗 <b>Channel:</b> ${o.channel.name}\n` +
      `📅 <b>Date:</b> ${o.createdAt.toISOString().slice(0, 10)}\n` +
      `📊 <b>Status:</b> ${o.status} | ${o.paymentStatus}\n\n` +
      `<b>Items:</b>\n${itemsText}\n\n` +
      `<b>Financial Breakdown:</b>\n` +
      `Subtotal: ${money(snap.totalSales.minus(snap.tax).minus(snap.shippingIncome).minus(snap.otherIncome).minus(snap.otherCost).toFixed(2))}\n` +
      `Discount: -${money(Number(o.discount).toFixed(2))}\n` +
      `Tax: ${money(snap.tax.toFixed(2))}\n` +
      `Shipping: ${money(snap.shippingIncome.toFixed(2))}\n` +
      `${snap.paymentFee.gt(0) ? `Payment Fee: ${money(snap.paymentFee.toFixed(2))}\n` : ""}` +
      `${snap.platformFee.gt(0) ? `Platform Fee: ${money(snap.platformFee.toFixed(2))}\n` : ""}` +
      `${snap.packagingCost.gt(0) ? `Packaging: ${money(snap.packagingCost.toFixed(2))}\n` : ""}` +
      `${snap.deliveryCost.gt(0) ? `Delivery Cost: ${money(snap.deliveryCost.toFixed(2))}\n` : ""}` +
      `${snap.orderExpenses.gt(0) ? `Other Expenses: ${money(snap.orderExpenses.toFixed(2))}\n` : ""}` +
      `─────────────\n` +
      `<b>Total: ${money(Number(o.total).toFixed(2))}</b>\n` +
      `Paid: ${money(Number(o.paidAmount).toFixed(2))}\n` +
      `Due: ${money(due.toFixed(2))}\n\n` +
      `<b>Profitability:</b>\n` +
      `COGS: ${money(snap.cogsTotal.toFixed(2))}\n` +
      `Gross Profit: ${money(snap.grossProfit.toFixed(2))}\n` +
      `Net Profit: ${money(snap.netProfit.toFixed(2))}\n` +
      `Margin: ${margin.toFixed(1)}%\n` +
      (o.delivery ? `\n<b>Delivery:</b> ${o.delivery.courierName ?? "—"} | ${o.delivery.trackingNumber ?? "—"} | ${o.delivery.status}` : "");

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
    // Use CustomerDueService.computeDue for the canonical due figure —
    // NOT inline arithmetic that could drift from the dashboard.
    try {
      const due = await CustomerDueService.computeDue(customerId);
      const c = await db.customer.findUnique({ where: { id: customerId }, include: { _count: { select: { orders: true } } } });
      if (!c) return TelegramService.sendMessage(ctx.chatId, "Customer not found");
      const completedOrders = await db.order.count({ where: { customerId: c.id, status: "COMPLETED" } });
      const cancelledOrders = await db.order.count({ where: { customerId: c.id, status: "CANCELLED" } });
      const returnedOrders = await db.order.count({ where: { customerId: c.id, status: "RETURNED" } });
      const lastOrder = await db.order.findFirst({ where: { customerId: c.id }, orderBy: { createdAt: "desc" }, select: { orderNumber: true, total: true, createdAt: true, status: true } });
      const text =
        `<b>👤 ${c.name}</b>\n` +
        `📞 ${c.phone}\n` +
        `📧 ${c.email ?? "—"}\n` +
        `🏙️ ${c.city ?? "—"}\n` +
        `📍 ${c.address ?? "—"}\n\n` +
        `<b>Orders:</b> ${due.orderCount} total (${completedOrders} completed, ${cancelledOrders} cancelled, ${returnedOrders} returned)\n\n` +
        `<b>Financials:</b>\n` +
        `Total Sales: ${money(due.totalSales)}\n` +
        `Total Paid: ${money(due.totalPaid)}\n` +
        `Refunds: ${money(due.totalRefund)}\n` +
        `Advance: ${money(due.advance)}\n` +
        `<b>Outstanding Due: ${money(due.totalDue)}</b>\n\n` +
        (due.lastPayment ? `Last Payment: ${money(due.lastPayment.amount)} (${due.lastPayment.method}) on ${due.lastPayment.date.toISOString().slice(0, 10)}\n` : "") +
        (lastOrder ? `\nLast Order: ${lastOrder.orderNumber} — ${money(Number(lastOrder.total).toFixed(2))} (${lastOrder.status})` : "");
      const rows: any[][] = [];
      if (this.can(ctx, "orders:create")) {
        rows.push([{ text: "🛒 Create Order", callback_data: "od_search_customer" }]);
      }
      rows.push([{ text: "⬅️ Back", callback_data: "customers_page:1" }]);
      await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  // --- Users (full CRUD via bot) ---
  async cmdUsers(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "users:read")) return this.deny(ctx, lang);
    await this.paginateUsers(ctx, 1, undefined, lang);
  },
  async paginateUsers(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "users:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.user.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 5, take: 5, include: { role: true } }),
      db.user.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>🧑‍💼 Users</b> (${total})\n\n` + items.map((u) => `• ${u.name} · ${u.role.name}${u.isActive ? "" : " (inactive)"}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((u) => [{ text: `${u.isActive ? "🟢" : "⚪"} ${u.name} (${u.role.name})`, callback_data: `user_view:${u.id}` }]);
    rows.push(this.paginationRow(page, totalPages, "users_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },

  async viewUser(ctx: CommandContext, userId: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "users:read")) return this.deny(ctx, lang);
    const u = await db.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!u) return TelegramService.sendMessage(ctx.chatId, "User not found");
    const text = `<b>${u.name}</b>\n📧 ${u.email}\n📞 ${u.phone ?? "—"}\n🎭 Role: <b>${u.role.name}</b>\n${u.isActive ? "🟢 Active" : "⚪ Inactive"}\n🕐 Last login: ${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "never"}`;
    const rows: any[][] = [];
    const isSelf = ctx.user?.id === u.id;
    if (this.can(ctx, "users:update") && !isSelf) {
      rows.push([{ text: "🎭 Change Role", callback_data: `user_role_menu:${u.id}` }]);
      rows.push([{ text: u.isActive ? "⛔ Deactivate" : "✅ Activate", callback_data: `user_toggle:${u.id}` }]);
      rows.push([{ text: "🔑 Reset Password", callback_data: `user_resetpw:${u.id}` }]);
    } else if (isSelf) {
      rows.push([{ text: "ℹ️ Manage your own account in the CRM dashboard", callback_data: "user_view:" + u.id }]);
    }
    rows.push([{ text: "⬅️ Back", callback_data: "users_page:1" }]);
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },

  async userRoleMenu(ctx: CommandContext, userId: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "users:update")) return this.deny(ctx, lang);
    const u = await db.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!u) return TelegramService.sendMessage(ctx.chatId, "User not found");
    const assignable = MANAGEABLE_ROLES.filter((r) => r !== u.role.name && (r !== "SUPER_ADMIN" || ctx.roleName === "SUPER_ADMIN"));
    const rows: any[][] = assignable.map((r) => [{ text: r, callback_data: `user_role_set:${u.id}|${r}` }]);
    rows.push([{ text: "⬅️ Back", callback_data: `user_view:${u.id}` }]);
    await this.sendOrEdit(ctx, `Select new role for <b>${u.name}</b> (current: ${u.role.name}):`, { inline_keyboard: rows }, messageId);
  },

  async confirmUserRolePrompt(ctx: CommandContext, userId: string, roleName: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "users:update")) return this.deny(ctx, lang);
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: `user_role_set_confirm:${userId}|${roleName}` },
      { text: this.t("no", lang), callback_data: `user_view:${userId}` },
    ]] };
    await this.sendOrEdit(ctx, `${this.t("confirm", lang)} Set role to <b>${roleName}</b>?`, kb, messageId);
  },

  async confirmUserRole(ctx: CommandContext, userId: string, roleName: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "users:update")) return this.deny(ctx, lang);
    try {
      const existing = await db.user.findUnique({ where: { id: userId }, include: { role: true } });
      if (!existing) throw new Error("User not found");
      if (roleName === "SUPER_ADMIN" && ctx.roleName !== "SUPER_ADMIN") throw new Error("Only a SUPER_ADMIN can assign the SUPER_ADMIN role");
      if (existing.role.name === "SUPER_ADMIN" && roleName !== "SUPER_ADMIN") {
        const count = await db.user.count({ where: { role: { name: "SUPER_ADMIN" }, isActive: true } });
        if (count <= 1) throw new Error("Cannot demote the last SUPER_ADMIN. Promote another user first.");
      }
      const role = await db.role.findUnique({ where: { name: roleName } });
      if (!role) throw new Error("Invalid role");
      const updated = await db.user.update({ where: { id: userId }, data: { roleId: role.id }, include: { role: true } });
      await AuditService.log({ userId: ctx.user?.id ?? null, action: "USER_UPDATE", entity: "User", entityId: userId, changes: { roleName, via: "telegram" } });
      await this.sendOrEdit(ctx, `${this.t("done", lang)} <b>${updated.name}</b> is now <b>${updated.role.name}</b>.`, { inline_keyboard: [[{ text: "⬅️ Back to user", callback_data: `user_view:${userId}` }]] }, messageId);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  async confirmUserTogglePrompt(ctx: CommandContext, userId: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "users:update")) return this.deny(ctx, lang);
    const u = await db.user.findUnique({ where: { id: userId } });
    if (!u) return TelegramService.sendMessage(ctx.chatId, "User not found");
    const nextState = u.isActive ? "inactive" : "active";
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: `user_toggle_confirm:${userId}|${nextState}` },
      { text: this.t("no", lang), callback_data: `user_view:${userId}` },
    ]] };
    await this.sendOrEdit(ctx, `${this.t("confirm", lang)} ${u.isActive ? "Deactivate" : "Activate"} <b>${u.name}</b>?`, kb, messageId);
  },

  async confirmUserToggle(ctx: CommandContext, userId: string, nextState: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "users:update")) return this.deny(ctx, lang);
    try {
      if (ctx.user?.id === userId) throw new Error("You cannot deactivate your own account");
      const existing = await db.user.findUnique({ where: { id: userId }, include: { role: true } });
      if (!existing) throw new Error("User not found");
      const isActive = nextState === "active";
      if (!isActive && existing.role.name === "SUPER_ADMIN") {
        const count = await db.user.count({ where: { role: { name: "SUPER_ADMIN" }, isActive: true } });
        if (count <= 1) throw new Error("Cannot deactivate the last SUPER_ADMIN. Promote another user first.");
      }
      const updated = await db.user.update({ where: { id: userId }, data: { isActive } });
      await AuditService.log({ userId: ctx.user?.id ?? null, action: "USER_UPDATE", entity: "User", entityId: userId, changes: { isActive, via: "telegram" } });
      await this.sendOrEdit(ctx, `${this.t("done", lang)} <b>${updated.name}</b> is now ${isActive ? "🟢 active" : "⚪ inactive"}.`, { inline_keyboard: [[{ text: "⬅️ Back to user", callback_data: `user_view:${userId}` }]] }, messageId);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  async confirmUserResetPwPrompt(ctx: CommandContext, userId: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "users:update")) return this.deny(ctx, lang);
    const u = await db.user.findUnique({ where: { id: userId } });
    if (!u) return TelegramService.sendMessage(ctx.chatId, "User not found");
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: `user_resetpw_confirm:${userId}` },
      { text: this.t("no", lang), callback_data: `user_view:${userId}` },
    ]] };
    await this.sendOrEdit(ctx, `${this.t("confirm", lang)} Reset password for <b>${u.name}</b>? A new temporary password will be generated.`, kb, messageId);
  },

  async confirmUserResetPw(ctx: CommandContext, userId: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "users:update")) return this.deny(ctx, lang);
    try {
      const u = await db.user.findUnique({ where: { id: userId } });
      if (!u) throw new Error("User not found");
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);
      // Bump tokenVersion to revoke any existing sessions for this user,
      // consistent with the CRM's normal password-reset behavior.
      await db.user.update({ where: { id: userId }, data: { passwordHash, tokenVersion: { increment: 1 } } });
      await AuditService.log({ userId: ctx.user?.id ?? null, action: "USER_UPDATE", entity: "User", entityId: userId, changes: { password: "[REDACTED]", via: "telegram" } });
      // Password is shown ONCE here, to the admin who requested it, and
      // never written to the audit log or logged anywhere else.
      await this.sendOrEdit(ctx, `${this.t("done", lang)} New password for <b>${u.name}</b>:\n\n<code>${tempPassword}</code>\n\n⚠️ Share this securely and ask them to change it after logging in.`, { inline_keyboard: [[{ text: "⬅️ Back to user", callback_data: `user_view:${userId}` }]] }, messageId);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  // /adduser Name | email | ROLE | phone(optional)
  async cmdAddUser(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "users:create")) return this.deny(ctx, lang);
    const usage = "Usage:\n<code>/adduser Full Name | email@example.com | ROLE | phone(optional)</code>\n\nRoles: " + MANAGEABLE_ROLES.join(", ");
    if (!raw) return TelegramService.sendMessage(ctx.chatId, usage);
    const parts = raw.split("|").map((p) => p.trim());
    if (parts.length < 3) return TelegramService.sendMessage(ctx.chatId, usage);
    const [name, email, roleRaw, phone] = parts;
    const roleName = roleRaw?.toUpperCase();
    if (!name || name.length < 2) return TelegramService.sendMessage(ctx.chatId, "❌ Name must be at least 2 characters.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return TelegramService.sendMessage(ctx.chatId, "❌ Invalid email address.");
    if (!MANAGEABLE_ROLES.includes(roleName as any)) return TelegramService.sendMessage(ctx.chatId, `❌ Invalid role. Choose one of: ${MANAGEABLE_ROLES.join(", ")}`);
    if (roleName === "SUPER_ADMIN" && ctx.roleName !== "SUPER_ADMIN") return TelegramService.sendMessage(ctx.chatId, "⛔ Only a SUPER_ADMIN can create SUPER_ADMIN users.");
    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return TelegramService.sendMessage(ctx.chatId, "❌ Email already in use.");
    const role = await db.role.findUnique({ where: { name: roleName } });
    if (!role) return TelegramService.sendMessage(ctx.chatId, "❌ Invalid role.");
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const created = await db.user.create({
      data: { name, email: email.toLowerCase(), phone: phone || undefined, passwordHash, roleId: role.id, isActive: true },
      include: { role: true },
    });
    await AuditService.log({ userId: ctx.user?.id ?? null, action: "USER_CREATE", entity: "User", entityId: created.id, changes: { email: created.email, role: role.name, via: "telegram" } });
    await TelegramService.sendMessage(
      ctx.chatId,
      `✅ User created: <b>${created.name}</b> (${role.name})\n📧 ${created.email}\n\n🔑 Temporary password:\n<code>${tempPassword}</code>\n\n⚠️ Share this securely and ask them to change it after logging in.`,
    );
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

  // ────────────────────────────────────────────────────────────────
  // NEW: Reports menu + per-report commands.
  // ────────────────────────────────────────────────────────────────
  async reportsMenu(ctx: CommandContext, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "reports:read")) return this.deny(ctx, lang);
    const btn = (label: string, type: string) => ({ text: label, callback_data: `reports_view:${type}` });
    const kb = {
      inline_keyboard: [
        [btn("📈 Profit & Loss", "profit-loss")],
        [btn("💰 Sales Report", "sales"), btn("💳 Payment Report", "payments")],
        [btn("📉 Expense Report", "expenses"), btn("📦 Inventory Report", "inventory")],
        [btn("🛍 Products Report", "products"), btn("👥 Customers Report", "customers")],
        [btn("🚚 Channel Report", "channels"), btn("💵 Cash Flow", "cash-flow")],
        [btn("← Back", "menu")],
      ],
    };
    const text = "<b>📈 Reports</b>\nSelect a report type:";
    if (messageId) await TelegramService.editMessage(ctx.chatId, messageId, text, kb);
    else await TelegramService.sendMessage(ctx.chatId, text, kb);
  },

  async viewReport(ctx: CommandContext, type: string, messageId: number | undefined, _lang: string) {
    if (!this.can(ctx, "reports:read")) return this.deny(ctx, _lang);
    const text = await this.renderReport(type);
    const kb = { inline_keyboard: [[{ text: "← Back", callback_data: "reports_menu" }]] };
    if (messageId) await TelegramService.editMessage(ctx.chatId, messageId, text, kb);
    else await TelegramService.sendMessage(ctx.chatId, text, kb);
  },

  // Shared renderer used by both the inline-button flow and the
  // /salesreport /profitreport /expensereport /inventoryreport
  // /paymentreport /orderreport /purchasereport command aliases.
  async renderReport(type: string): Promise<string> {
    switch (type) {
      case "profit-loss": {
        const pnl = await AccountingService.profitAndLoss();
        return `<b>📈 P&L Summary</b>\n\nRevenue: ${money(pnl.revenue.toFixed(2))}\nCOGS: ${money(pnl.cogs.toFixed(2))}\nGross Profit: ${money(pnl.grossProfit.toFixed(2))}\nOperating Expenses: ${money(pnl.operatingExpenses.toFixed(2))}\nNet Profit: ${money(pnl.netProfit.toFixed(2))}\nOrders: ${pnl.orderCount}`;
      }
      case "sales": {
        // trend(days) returns [{ date, sales: string, expenses: string, orders }]
        const s = await AccountingService.trend(30);
        const lines = s.map((d: any) => `${d.date}: ${money(d.sales ?? "0")} (${d.orders ?? 0} orders)`).join("\n");
        return `<b>💰 Sales — last 30 days</b>\n\n${lines || "No sales"}`;
      }
      case "payments": {
        // paymentStats() returns [{ method, total: string, count: number }]
        const rows = await AccountingService.paymentStats();
        const totalReceived = rows.reduce((s: number, r: any) => s + Number(r.total ?? 0), 0);
        const lines = rows.map((r: any) => `  ${r.method}: ${money(r.total)} (${r.count} txns)`).join("\n");
        return `<b>💳 Payment Report</b>\n\nTotal Received: ${money(totalReceived.toFixed(2))}\nBy Method:\n${lines || "No payments"}`;
      }
      case "expenses": {
        const byCat = await AccountingService.expenseByCategory();
        const lines = byCat.map((c: any) => `${c.category}: ${money(c.total)} (${c.count})`).join("\n");
        return `<b>📉 Expenses by Category</b>\n\n${lines || "No expenses"}`;
      }
      case "inventory": {
        const items = await db.inventory.findMany({ include: { product: true }, take: 20, orderBy: { quantity: "asc" } });
        const lines = items.map((i: any) => `${i.product?.name ?? "—"} (${i.product?.sku ?? "—"}): ${i.quantity} (min ${i.minimumStock})`).join("\n");
        return `<b>📦 Inventory — 20 lowest-stock items</b>\n\n${lines || "No inventory"}`;
      }
      case "products": {
        // topProducts(range, limit) returns [{ productId, name, sku, quantity, revenue, cogs, profit }]
        const top = await AccountingService.topProducts(undefined, 10);
        const lines = top.map((p: any, i: number) => `${i + 1}. ${p.name} — ${p.quantity} sold · ${money(p.revenue)}`).join("\n");
        return `<b>🛍 Top 10 Products</b>\n\n${lines || "No data"}`;
      }
      case "customers": {
        const top = await db.customer.findMany({ take: 10, orderBy: { createdAt: "desc" }, include: { orders: true } });
        const lines = top.map((c: any) => `${c.name} — ${c.orders.length} orders`).join("\n");
        return `<b>👥 Recent Customers</b>\n\n${lines || "No customers"}`;
      }
      case "channels": {
        // salesByChannel() returns [{ name, revenue: string, orders: number }]
        const ch = await AccountingService.salesByChannel();
        const lines = ch.map((c: any) => `${c.name}: ${money(c.revenue)} (${c.orders} orders)`).join("\n");
        return `<b>🚚 Sales by Channel</b>\n\n${lines || "No data"}`;
      }
      case "cash-flow": {
        const cs: any = await CashService.summary();
        const num = (v: any) => Number(v ?? 0).toFixed(2);
        return `<b>💵 Cash Flow</b>\n\nOpening: ${money(num(cs.openingBalance))}\n+ Cash Sales: ${money(num(cs.cashSales))}\n+ Customer Payments: ${money(num(cs.customerPayments))}\n− Refunds: ${money(num(cs.refunds))}\n− Expenses: ${money(num(cs.expenses))}\n= Closing: ${money(num(cs.closingBalance))}`;
      }
      default:
        return "❌ Unknown report type. Use the reports menu.";
    }
  },

  // Per-report command aliases (so users can type /salesreport etc.).
  async cmdSalesReport(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "reports:read")) return this.deny(ctx, lang);
    await TelegramService.sendMessage(ctx.chatId, await this.renderReport("sales"));
  },
  async cmdProfitReport(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "reports:read")) return this.deny(ctx, lang);
    await TelegramService.sendMessage(ctx.chatId, await this.renderReport("profit-loss"));
  },
  async cmdExpenseReport(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "reports:read")) return this.deny(ctx, lang);
    await TelegramService.sendMessage(ctx.chatId, await this.renderReport("expenses"));
  },
  async cmdInventoryReport(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "reports:read")) return this.deny(ctx, lang);
    await TelegramService.sendMessage(ctx.chatId, await this.renderReport("inventory"));
  },
  async cmdPaymentReport(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "reports:read")) return this.deny(ctx, lang);
    await TelegramService.sendMessage(ctx.chatId, await this.renderReport("payments"));
  },
  async cmdOrderReport(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "reports:read")) return this.deny(ctx, lang);
    const count = await db.order.count();
    const byStatus = await db.order.groupBy({ by: ["status"], _count: true });
    const lines = byStatus.map((s: any) => `${s.status}: ${s._count}`).join("\n");
    await TelegramService.sendMessage(ctx.chatId, `<b>📋 Order Report</b>\n\nTotal: ${count}\n\n${lines}`);
  },
  async cmdPurchaseReport(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "reports:read")) return this.deny(ctx, lang);
    const count = await db.purchase.count();
    const byStatus = await db.purchase.groupBy({ by: ["status"], _count: true });
    const lines = byStatus.map((s: any) => `${s.status}: ${s._count}`).join("\n");
    await TelegramService.sendMessage(ctx.chatId, `<b>🛒 Purchase Report</b>\n\nTotal: ${count}\n\n${lines}`);
  },

  // ────────────────────────────────────────────────────────────────
  // NEW: /refunds, /receivepayment, /lowstock, /stockadjust
  // ────────────────────────────────────────────────────────────────
  async cmdRefunds(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "refunds:read")) return this.deny(ctx, lang);
    const refunds = await db.refund.findMany({ take: 10, orderBy: { createdAt: "desc" }, include: { order: true } });
    if (!refunds.length) return TelegramService.sendMessage(ctx.chatId, "📭 No refunds found.");
    const lines = refunds.map((r: any) => `#${r.order?.orderNumber ?? "—"} — ${money(r.amount.toFixed(2))} (${r.method}) — ${r.notes ?? ""}`).join("\n");
    await TelegramService.sendMessage(ctx.chatId, `<b>💸 Recent Refunds</b>\n\n${lines}`);
  },

  async cmdReceivePayment(ctx: CommandContext, args: string[], lang: string) {
    if (!this.can(ctx, "payments:create")) return this.deny(ctx, lang);
    // /receivepayment ORDER_ID|AMOUNT|METHOD|REFERENCE?
    const [orderId, amountStr, method, ref] = args.join(" ").split("|").map((s: string) => s.trim());
    if (!orderId || !amountStr || !method) {
      return TelegramService.sendMessage(ctx.chatId, "Usage: /receivepayment ORDER_ID | AMOUNT | METHOD | REFERENCE?\n\nMETHOD: CASH, BKASH, NAGAD, BANK, CARD, OTHER");
    }
    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) return TelegramService.sendMessage(ctx.chatId, "❌ Invalid amount.");
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) return TelegramService.sendMessage(ctx.chatId, "❌ Order not found. Use the order ID (not the order number).");
    // ── Use PaymentService.create (NOT direct db.payment.create) ──
    // This enforces all integrity guards:
    //   - rejects payments on CANCELLED/REFUNDED/RETURN_REQUESTED orders
    //   - prevents overpayment
    //   - idempotent on transactionReference (duplicate ref → returns existing)
    //   - writes PAYMENT_CREATE audit log
    //   - fires PAYMENT_RECEIVED automation + Telegram notification
    try {
      const payment = await PaymentService.create({
        orderId: order.id,
        amount,
        method: method.toUpperCase(),
        transactionReference: ref || undefined,
        createdBy: ctx.user?.id,
      });
      const paid = await db.order.findUnique({ where: { id: order.id } });
      await TelegramService.sendMessage(ctx.chatId,
        `✅ Payment recorded for order ${order.orderNumber}\n` +
        `Amount: ${money(amount.toFixed(2))} (${method.toUpperCase()})\n` +
        `Order Total: ${money(Number(paid?.total ?? 0).toFixed(2))}\n` +
        `Paid: ${money(Number(paid?.paidAmount ?? 0).toFixed(2))}\n` +
        `Status: ${paid?.paymentStatus ?? "UNPAID"}` +
        (ref ? `\nReference: ${ref}` : "")
      );
      void payment;
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  async cmdLowStock(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "inventory:read")) return this.deny(ctx, lang);
    const items = await db.inventory.findMany({
      where: { OR: [{ quantity: { lte: 0 } }, { reservedQuantity: { gt: 0 } }] },
      include: { product: true },
      take: 30,
    });
    // Also include items where available <= minimumStock
    const low = items.filter((i: any) => {
      const avail = (i.quantity ?? 0) - (i.reservedQuantity ?? 0);
      return avail <= (i.minimumStock ?? 0);
    });
    if (!low.length) return TelegramService.sendMessage(ctx.chatId, "✅ No low-stock items.");
    const lines = low.map((i: any) => `🔴 ${i.product?.name ?? "—"} (${i.product?.sku ?? "—"}): ${i.quantity - i.reservedQuantity} available`).join("\n");
    await TelegramService.sendMessage(ctx.chatId, `<b>⚠️ Low Stock</b>\n\n${lines}`);
  },

  async cmdStockAdjustShortcut(ctx: CommandContext, args: string[], lang: string) {
    if (!this.can(ctx, "inventory:adjust")) return this.deny(ctx, lang);
    // /stockadjust PRODUCT_ID|NEW_QTY|REASON?
    const [productId, qtyStr, reason] = args.join(" ").split("|").map((s: string) => s.trim());
    if (!productId || !qtyStr) return TelegramService.sendMessage(ctx.chatId, "Usage: /stockadjust PRODUCT_ID | NEW_QTY | REASON?");
    const newQty = Number(qtyStr);
    if (!Number.isFinite(newQty)) return TelegramService.sendMessage(ctx.chatId, "❌ Invalid quantity.");
    const inv = await db.inventory.findUnique({ where: { productId } });
    if (!inv) return TelegramService.sendMessage(ctx.chatId, "❌ Inventory not found for that product.");
    const delta = newQty - (inv.quantity as number);
    await InventoryService.applyMovement({
      productId,
      type: "ADJUSTMENT",
      quantityChange: delta,
      referenceType: "MANUAL",
      reason: reason || `Telegram adjust to ${newQty}`,
      createdBy: ctx.user?.id,
    });
    await TelegramService.sendMessage(ctx.chatId, `✅ Stock adjusted. New quantity: ${newQty}`);
  },

  // ────────────────────────────────────────────────────────────────
  // NEW: /today /summary /dashboard — quick KPI snapshots
  // ────────────────────────────────────────────────────────────────
  async cmdToday(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "dashboard:read") && !this.can(ctx, "reports:read")) return this.deny(ctx, lang);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    // Use the centralized ProfitabilityService so the numbers match the
    // dashboard and reports exactly. Previously this method re-implemented
    // the P&L inline, which could drift from the canonical calculation.
    const pnl = await ProfitabilityService.aggregate({ from: start, to: end });
    const lowStock = await db.inventory.count({ where: { OR: [{ quantity: { lte: 0 } }, { reservedQuantity: { gt: 0 } }] } });
    const text = `<b>📊 Today's Business Summary</b>\n\n` +
      `Orders: ${pnl.orderCount}\n` +
      `Sales: ${money(pnl.totalSales.toFixed(2))}\n` +
      `Payments: ${money(pnl.paidTotal.toFixed(2))}\n` +
      `Due: ${money(pnl.outstanding.toFixed(2))}\n\n` +
      `COGS: ${money(pnl.cogs.toFixed(2))}\n` +
      `Expenses: ${money(pnl.operatingExpenses.toFixed(2))}\n\n` +
      `Gross Profit: ${money(pnl.grossProfit.toFixed(2))}\n` +
      `Net Profit: ${money(pnl.netProfit.toFixed(2))}\n\n` +
      `Low-Stock Items: ${lowStock}`;
    await TelegramService.sendMessage(ctx.chatId, text);
  },

  async cmdSummary(ctx: CommandContext, _args: string[], lang: string) {
    // Alias for /today
    return this.cmdToday(ctx, _args, lang);
  },

  async cmdDashboard(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "dashboard:read") && !this.can(ctx, "reports:read")) return this.deny(ctx, lang);
    const pnl = await ProfitabilityService.aggregate();
    const lowStock = await db.inventory.count({ where: { OR: [{ quantity: { lte: 0 } }, { reservedQuantity: { gt: 0 } }] } });
    const pendingOrders = await db.order.count({ where: { status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP"] } } });
    await TelegramService.sendMessage(ctx.chatId, `<b>🏠 Dashboard</b>\n\nRevenue: ${money(pnl.totalSales.toFixed(2))}\nNet Profit: ${money(pnl.netProfit.toFixed(2))}\nPending Orders: ${pendingOrders}\nLow-Stock Items: ${lowStock}`);
  },

  // ────────────────────────────────────────────────────────────────
  // NEW: /profit today|week|month|YYYY-MM-DD YYYY-MM-DD
  // Flexible date-range profit command. Parses the arg and delegates to
  // ProfitabilityService.aggregate (the same service the dashboard uses).
  // ────────────────────────────────────────────────────────────────
  async cmdProfit(ctx: CommandContext, args: string[], lang: string) {
    if (!this.can(ctx, "reports:read") && !this.can(ctx, "dashboard:read")) return this.deny(ctx, lang);
    const range = this.parseDateRange(args);
    if (!range) {
      return TelegramService.sendMessage(ctx.chatId,
        "Usage: /profit today | yesterday | week | month | lastmonth | YYYY-MM-DD YYYY-MM-DD\n\n" +
        "Examples:\n" +
        "  /profit today\n" +
        "  /profit week\n" +
        "  /profit month\n" +
        "  /profit 2026-08-01 2026-08-28"
      );
    }
    const pnl = await ProfitabilityService.aggregate(range);
    const label = this.dateRangeLabel(args);
    const text = `<b>📈 Profit & Loss — ${label}</b>\n\n` +
      `Orders: ${pnl.orderCount}\n\n` +
      `Gross Sales: ${money(pnl.grossSales.toFixed(2))}\n` +
      `− Discounts: ${money(pnl.discounts.toFixed(2))}\n` +
      `+ Tax: ${money(pnl.tax.toFixed(2))}\n` +
      `+ Shipping Income: ${money(pnl.shippingIncome.toFixed(2))}\n` +
      `+ Other Income: ${money(pnl.otherIncome.toFixed(2))}\n` +
      `= Total Sales: ${money(pnl.totalSales.toFixed(2))}\n\n` +
      `− COGS: ${money(pnl.cogs.toFixed(2))}\n` +
      `= Gross Profit: ${money(pnl.grossProfit.toFixed(2))}\n\n` +
      `− Packaging: ${money(pnl.packagingCost.toFixed(2))}\n` +
      `− Payment Fees: ${money(pnl.paymentFee.toFixed(2))}\n` +
      `− Platform Fees: ${money(pnl.platformFee.toFixed(2))}\n` +
      `− Delivery Cost: ${money(pnl.deliveryCost.toFixed(2))}\n` +
      `− Order Expenses: ${money(pnl.orderExpenses.toFixed(2))}\n` +
      `− Operating Expenses: ${money(pnl.operatingExpenses.toFixed(2))}\n` +
      `− Refunds: ${money(pnl.refunds.toFixed(2))}\n` +
      `= Net Profit: ${money(pnl.netProfit.toFixed(2))}\n\n` +
      `Payments Received: ${money(pnl.paidTotal.toFixed(2))}\n` +
      `Outstanding (Due): ${money(pnl.outstanding.toFixed(2))}`;
    await TelegramService.sendMessage(ctx.chatId, text);
  },

  // Parse /profit args into a DateRange. Returns null on invalid input.
  // Supported: today, yesterday, week, month, lastmonth, YYYY-MM-DD [YYYY-MM-DD]
  parseDateRange(args: string[]): { from?: Date; to?: Date } | null {
    if (!args.length) return null;
    const preset = args[0]?.toLowerCase();
    const now = new Date();
    if (preset === "today") {
      const from = new Date(); from.setHours(0, 0, 0, 0);
      const to = new Date(); to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    if (preset === "yesterday") {
      const from = new Date(); from.setDate(from.getDate() - 1); from.setHours(0, 0, 0, 0);
      const to = new Date(); to.setDate(to.getDate() - 1); to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    if (preset === "week") {
      const from = new Date(); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0);
      const to = new Date(); to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    if (preset === "month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const to = new Date();
      return { from, to };
    }
    if (preset === "lastmonth") {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from, to };
    }
    // Try ISO date parsing: /profit 2026-08-01 2026-08-28
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(args[0])) {
      const from = new Date(args[0] + "T00:00:00");
      if (args[1] && dateRegex.test(args[1])) {
        const to = new Date(args[1] + "T23:59:59");
        return { from, to };
      }
      // Single date → that day only
      const to = new Date(args[0] + "T23:59:59");
      return { from, to };
    }
    return null;
  },

  // Human-readable label for the date range, for the Telegram message header.
  dateRangeLabel(args: string[]): string {
    if (!args.length) return "All Time";
    const preset = args[0]?.toLowerCase();
    if (preset === "today") return "Today";
    if (preset === "yesterday") return "Yesterday";
    if (preset === "week") return "Last 7 Days";
    if (preset === "month") return "This Month";
    if (preset === "lastmonth") return "Last Month";
    if (args.length >= 2) return `${args[0]} to ${args[1]}`;
    if (args.length === 1) return args[0];
    return "Custom Range";
  },

  // ────────────────────────────────────────────────────────────────
  // NEW: /cogs — COGS breakdown for a date range
  // ────────────────────────────────────────────────────────────────
  async cmdCogs(ctx: CommandContext, args: string[], lang: string) {
    if (!this.can(ctx, "reports:read") && !this.can(ctx, "dashboard:read")) return this.deny(ctx, lang);
    const range = this.parseDateRange(args.length ? args : ["month"]);
    const pnl = await ProfitabilityService.aggregate(range ?? undefined);
    const label = this.dateRangeLabel(args.length ? args : ["month"]);
    await TelegramService.sendMessage(ctx.chatId,
      `<b>📦 COGS Report — ${label}</b>\n\n` +
      `Orders: ${pnl.orderCount}\n` +
      `Total Sales: ${money(pnl.totalSales.toFixed(2))}\n` +
      `COGS: ${money(pnl.cogs.toFixed(2))}\n` +
      `Gross Profit: ${money(pnl.grossProfit.toFixed(2))}\n` +
      `Gross Margin: ${pnl.totalSales.gt(0) ? pnl.grossProfit.dividedBy(pnl.totalSales).times(100).toFixed(1) : "0"}%`
    );
  },

  // ────────────────────────────────────────────────────────────────
  // NEW: /sales — sales summary for a date range
  // ────────────────────────────────────────────────────────────────
  async cmdSales(ctx: CommandContext, args: string[], lang: string) {
    if (!this.can(ctx, "reports:read") && !this.can(ctx, "dashboard:read")) return this.deny(ctx, lang);
    const range = this.parseDateRange(args.length ? args : ["month"]);
    const pnl = await ProfitabilityService.aggregate(range ?? undefined);
    const label = this.dateRangeLabel(args.length ? args : ["month"]);
    await TelegramService.sendMessage(ctx.chatId,
      `<b>💰 Sales Report — ${label}</b>\n\n` +
      `Orders: ${pnl.orderCount}\n` +
      `Gross Sales: ${money(pnl.grossSales.toFixed(2))}\n` +
      `− Discounts: ${money(pnl.discounts.toFixed(2))}\n` +
      `+ Tax: ${money(pnl.tax.toFixed(2))}\n` +
      `+ Shipping Income: ${money(pnl.shippingIncome.toFixed(2))}\n` +
      `+ Other Income: ${money(pnl.otherIncome.toFixed(2))}\n` +
      `= Total Sales: ${money(pnl.totalSales.toFixed(2))}\n\n` +
      `Payments Received: ${money(pnl.paidTotal.toFixed(2))}\n` +
      `Outstanding: ${money(pnl.outstanding.toFixed(2))}`
    );
  },

  // ────────────────────────────────────────────────────────────────
  // NEW: /duereport — customer due aging summary
  // Shows total outstanding across all customers with aging buckets.
  // ────────────────────────────────────────────────────────────────
  async cmdDueReport(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "reports:read") && !this.can(ctx, "customers:read")) return this.deny(ctx, lang);
    // Aggregate outstanding across all customers via the same computeDue logic.
    const customers = await db.customer.findMany({
      where: { orders: { some: { status: { not: "CANCELLED" } } } },
      include: { customerCredit: true },
      take: 200, // bound the query
    });
    let totalDue = new Prisma.Decimal(0);
    const aging = { "0-7": new Prisma.Decimal(0), "8-30": new Prisma.Decimal(0), "31-60": new Prisma.Decimal(0), "61-90": new Prisma.Decimal(0), "90+": new Prisma.Decimal(0) };
    let customersWithDue = 0;
    for (const c of customers) {
      const due = await CustomerDueService.computeDue(c.id);
      const dueAmt = toDecimal(due.totalDue);
      if (dueAmt.gt(0)) {
        customersWithDue++;
        totalDue = totalDue.plus(dueAmt);
        aging["0-7"] = aging["0-7"].plus(toDecimal(due.aging["0-7"]));
        aging["8-30"] = aging["8-30"].plus(toDecimal(due.aging["8-30"]));
        aging["31-60"] = aging["31-60"].plus(toDecimal(due.aging["31-60"]));
        aging["61-90"] = aging["61-90"].plus(toDecimal(due.aging["61-90"]));
        aging["90+"] = aging["90+"].plus(toDecimal(due.aging["90+"]));
      }
    }
    await TelegramService.sendMessage(ctx.chatId,
      `<b>💸 Customer Due Report</b>\n\n` +
      `Customers with outstanding: ${customersWithDue}\n` +
      `Total Outstanding: ${money(totalDue.toFixed(2))}\n\n` +
      `<b>Aging:</b>\n` +
      `0–7 days: ${money(aging["0-7"].toFixed(2))}\n` +
      `8–30 days: ${money(aging["8-30"].toFixed(2))}\n` +
      `31–60 days: ${money(aging["31-60"].toFixed(2))}\n` +
      `61–90 days: ${money(aging["61-90"].toFixed(2))}\n` +
      `90+ days: ${money(aging["90+"].toFixed(2))}\n\n` +
      `Use /due to view per-customer details.`
    );
  },

  // ────────────────────────────────────────────────────────────────
  // NEW: Interactive multi-step /createorder flow.
  //
  // Uses TelegramSessionStore for per-user conversation state.
  // Flow: customer → product search → product select → variation →
  //       qty → add more? → shipping → discount → payment method →
  //       payment amount → summary → confirm → create.
  //
  // SECURITY: session is keyed by (telegramUserId, chatId). Callback
  // handlers re-resolve the session from the sender's identity — never
  // from callback_data. So user B tapping user A's button can't mutate
  // user A's draft.
  // ────────────────────────────────────────────────────────────────
  async startInteractiveOrder(ctx: CommandContext, lang: string) {
    const draft = TelegramSessionStore.startOrderDraft(ctx.telegramUserId, ctx.chatId);
    await TelegramService.sendMessage(
      ctx.chatId,
      `🛒 <b>Interactive Order Creation</b>\n\nStep 1: Select Customer\n\nSend a phone number to search, or use the buttons below.`,
      {
        inline_keyboard: [
          [{ text: "🔍 Recent Customers", callback_data: "od_search_customer" }],
          [{ text: "➕ New Customer", callback_data: "od_new_customer" }],
          [{ text: "❌ Cancel", callback_data: "od_cancel" }],
        ],
      },
    );
    void draft;
  },

  // Text input handler — captures user input for the current draft step.
  async handleOrderDraftTextInput(ctx: CommandContext, text: string, lang: string): Promise<boolean> {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return false; // no active session → let the message fall through

    // Re-check permission on every interaction (session alone doesn't authorise).
    if (!this.can(ctx, "orders:create")) {
      TelegramSessionStore.clearOrderDraft(ctx.telegramUserId, ctx.chatId);
      await TelegramService.sendMessage(ctx.chatId, "⛔ Permission denied. Order draft cancelled.");
      return true;
    }

    const step = draft.step;
    try {
      if (step === "customer") {
        // If in new-customer mode, parse "Name | Phone". Otherwise search.
        if (draft.lastSearchQuery === "__new_customer__") {
          return await this.odHandleNewCustomerInput(ctx, text, lang, draft);
        }
        // User typed a phone number or name — search customers.
        return await this.odHandleCustomerSearch(ctx, text, lang, draft);
      }
      if (step === "product_search") {
        // User typed a product name or SKU — search products.
        return await this.odHandleProductSearch(ctx, text, lang, draft);
      }
      if (step === "quantity") {
        // User typed a quantity for the pending product.
        return await this.odHandleQuantityInput(ctx, text, lang, draft);
      }
      if (step === "shipping") {
        return await this.odHandleShippingInput(ctx, text, lang, draft);
      }
      if (step === "discount") {
        return await this.odHandleDiscountInput(ctx, text, lang, draft);
      }
      if (step === "payment_amount") {
        return await this.odHandlePaymentAmountInput(ctx, text, lang, draft);
      }
      // Unknown step — ignore (let the message fall through).
      return false;
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}\n\nSend /createorder to restart.`);
      TelegramSessionStore.clearOrderDraft(ctx.telegramUserId, ctx.chatId);
      return true;
    }
  },

  // ── Customer search ──
  async odSearchCustomer(ctx: CommandContext, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    draft.step = "customer";
    TelegramSessionStore.saveOrderDraft(draft);
    await this.sendOrEdit(
      ctx,
      `🛒 <b>Step 1: Select Customer</b>\n\nSend a phone number or name to search, or browse recent customers below.`,
      {
        inline_keyboard: [
          [{ text: "🔍 Recent Customers", callback_data: "od_search_customer" }],
          [{ text: "➕ New Customer", callback_data: "od_new_customer" }],
          [{ text: "❌ Cancel", callback_data: "od_cancel" }],
        ],
      },
      messageId,
    );
    // Show recent customers
    const customers = await db.customer.findMany({ orderBy: { createdAt: "desc" }, take: 8 });
    if (customers.length > 0) {
      const rows = customers.map((c) => [{ text: `👤 ${c.name} · ${c.phone}`, callback_data: `od_select_customer:${c.id}` }]);
      rows.push([{ text: "❌ Cancel", callback_data: "od_cancel" }]);
      await TelegramService.sendMessage(ctx.chatId, "Recent customers:", { inline_keyboard: rows });
    }
  },

  async odHandleCustomerSearch(ctx: CommandContext, text: string, lang: string, draft: OrderDraft): Promise<boolean> {
    // Search by phone or name
    const customers = await db.customer.findMany({
      where: { OR: [{ phone: { contains: text } }, { name: { contains: text, mode: "insensitive" } }] },
      take: 8,
    });
    if (customers.length === 0) {
      await TelegramService.sendMessage(ctx.chatId, `No customers found for "${text}".\n\nSend another search, or /createorder to start over.`);
      return true;
    }
    const rows = customers.map((c) => [{ text: `👤 ${c.name} · ${c.phone}`, callback_data: `od_select_customer:${c.id}` }]);
    rows.push([{ text: "❌ Cancel", callback_data: "od_cancel" }]);
    await TelegramService.sendMessage(ctx.chatId, `Found ${customers.length} customer(s):`, { inline_keyboard: rows });
    return true;
  },

  async odSelectCustomer(ctx: CommandContext, customerId: string, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) return TelegramService.sendMessage(ctx.chatId, "❌ Customer not found.");
    draft.customerId = customer.id;
    draft.customerName = customer.name;
    draft.customerPhone = customer.phone;
    draft.step = "product_search";
    TelegramSessionStore.saveOrderDraft(draft);
    await this.sendOrEdit(
      ctx,
      `✅ Customer: <b>${customer.name}</b> (${customer.phone})\n\n🛒 <b>Step 2: Select Product</b>\n\nSend a product name or SKU to search.`,
      {
        inline_keyboard: [
          [{ text: "🔍 Recent Products", callback_data: "od_search_product" }],
          [{ text: "❌ Cancel", callback_data: "od_cancel" }],
        ],
      },
      messageId,
    );
    // Show recent products
    const products = await db.product.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, sku: true, sellingPrice: true } });
    if (products.length > 0) {
      const rows = products.map((p) => [{ text: `📦 ${p.name} (${p.sku}) — ${money(p.sellingPrice.toFixed(2))}`, callback_data: `od_select_product:${p.id}` }]);
      rows.push([{ text: "❌ Cancel", callback_data: "od_cancel" }]);
      await TelegramService.sendMessage(ctx.chatId, "Recent products:", { inline_keyboard: rows });
    }
  },

  async odNewCustomerPrompt(ctx: CommandContext, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    draft.step = "customer";
    draft.lastSearchQuery = "__new_customer__";
    TelegramSessionStore.saveOrderDraft(draft);
    await this.sendOrEdit(
      ctx,
      `➕ <b>New Customer</b>\n\nSend customer details in this format:\n\n<code>Name | Phone</code>\n\nExample: <code>John Doe | 01712345678</code>`,
      { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "od_search_customer" }], [{ text: "❌ Cancel", callback_data: "od_cancel" }]] },
      messageId,
    );
  },

  async odHandleNewCustomerInput(ctx: CommandContext, text: string, lang: string, draft: OrderDraft): Promise<boolean> {
    const [name, phone] = text.split("|").map((s) => s.trim());
    if (!name || !phone) {
      await TelegramService.sendMessage(ctx.chatId, "❌ Format: Name | Phone\n\nExample: John Doe | 01712345678");
      return true;
    }
    // Check if phone already exists
    const existing = await db.customer.findUnique({ where: { phone } });
    if (existing) {
      draft.customerId = existing.id;
      draft.customerName = existing.name;
      draft.customerPhone = existing.phone;
    } else {
      const created = await db.customer.create({ data: { name, phone } });
      draft.customerId = created.id;
      draft.customerName = created.name;
      draft.customerPhone = created.phone;
    }
    draft.step = "product_search";
    draft.lastSearchQuery = undefined;
    TelegramSessionStore.saveOrderDraft(draft);
    await TelegramService.sendMessage(
      ctx.chatId,
      `✅ Customer: <b>${draft.customerName}</b> (${draft.customerPhone})\n\n🛒 <b>Step 2: Select Product</b>\n\nSend a product name or SKU to search.`,
    );
    return true;
  },

  // ── Product search ──
  async odSearchProduct(ctx: CommandContext, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    draft.step = "product_search";
    TelegramSessionStore.saveOrderDraft(draft);
    const products = await db.product.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, name: true, sku: true, sellingPrice: true } });
    if (products.length === 0) {
      return this.sendOrEdit(ctx, "No active products found.", { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "od_cancel" }]] }, messageId);
    }
    const rows = products.map((p) => [{ text: `📦 ${p.name} (${p.sku}) — ${money(p.sellingPrice.toFixed(2))}`, callback_data: `od_select_product:${p.id}` }]);
    rows.push([{ text: "❌ Cancel", callback_data: "od_cancel" }]);
    await this.sendOrEdit(ctx, `🛒 <b>Select Product</b> (${products.length} recent)\n\nOr send a product name/SKU to search.`, { inline_keyboard: rows }, messageId);
  },

  async odHandleProductSearch(ctx: CommandContext, text: string, lang: string, draft: OrderDraft): Promise<boolean> {
    const products = await db.product.findMany({
      where: { AND: [{ status: "ACTIVE" }, { OR: [{ sku: { contains: text, mode: "insensitive" } }, { name: { contains: text, mode: "insensitive" } }] }] },
      take: 10,
      select: { id: true, name: true, sku: true, sellingPrice: true, purchasePrice: true, weightedAverageCost: true },
    });
    if (products.length === 0) {
      await TelegramService.sendMessage(ctx.chatId, `No products found for "${text}".\n\nSend another search term.`);
      return true;
    }
    const rows = products.map((p) => [{ text: `📦 ${p.name} (${p.sku}) — ${money(p.sellingPrice.toFixed(2))}`, callback_data: `od_select_product:${p.id}` }]);
    rows.push([{ text: "❌ Cancel", callback_data: "od_cancel" }]);
    await TelegramService.sendMessage(ctx.chatId, `Found ${products.length} product(s):`, { inline_keyboard: rows });
    return true;
  },

  async odSelectProduct(ctx: CommandContext, productId: string, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    const product = await db.product.findUnique({ where: { id: productId }, include: { productVariants: { where: { isActive: true } } } });
    if (!product) return TelegramService.sendMessage(ctx.chatId, "❌ Product not found.");

    // Check for variants — if the product has variants, show variation selection.
    if (product.productVariants.length > 0) {
      draft.pendingProduct = {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitPrice: product.sellingPrice,
        unitCost: product.weightedAverageCost || product.purchasePrice,
        isVariable: true,
      };
      draft.step = "variation";
      TelegramSessionStore.saveOrderDraft(draft);
      const rows = product.productVariants.map((v) => [{ text: `🎨 ${v.name} (${v.sku}) — ${money(v.sellingPrice.toFixed(2))}`, callback_data: `od_select_variation:${v.id}` }]);
      rows.push([{ text: "⬅️ Back", callback_data: "od_search_product" }]);
      rows.push([{ text: "❌ Cancel", callback_data: "od_cancel" }]);
      await this.sendOrEdit(ctx, `🎨 <b>${product.name}</b> — Select Variation:`, { inline_keyboard: rows }, messageId);
    } else {
      // Simple product — skip variation, go to quantity.
      draft.pendingProduct = {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitPrice: product.sellingPrice,
        unitCost: product.weightedAverageCost || product.purchasePrice,
        isVariable: false,
      };
      draft.step = "quantity";
      TelegramSessionStore.saveOrderDraft(draft);
      await this.sendOrEdit(
        ctx,
        `📦 <b>${product.name}</b> (${product.sku}) — ${money(product.sellingPrice.toFixed(2))}\n\n🔢 <b>Step 3: Quantity</b>\n\nSend the quantity (e.g. 2):`,
        { inline_keyboard: [[{ text: "1", callback_data: "od_set_qty:1" }, { text: "2", callback_data: "od_set_qty:2" }, { text: "5", callback_data: "od_set_qty:5" }, { text: "10", callback_data: "od_set_qty:10" }], [{ text: "⬅️ Back", callback_data: "od_search_product" }], [{ text: "❌ Cancel", callback_data: "od_cancel" }]] },
        messageId,
      );
    }
  },

  async odSelectVariation(ctx: CommandContext, variationId: string, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    const variant = await db.productVariant.findUnique({ where: { id: variationId } });
    if (!variant) return TelegramService.sendMessage(ctx.chatId, "❌ Variation not found.");
    // Update the pending product with the variation's price/cost.
    if (draft.pendingProduct) {
      draft.pendingProduct.unitPrice = variant.sellingPrice;
      draft.pendingVariationId = variant.id;
    }
    draft.step = "quantity";
    TelegramSessionStore.saveOrderDraft(draft);
    await this.sendOrEdit(
      ctx,
      `🎨 ${variant.name} — ${money(variant.sellingPrice.toFixed(2))}\n\n🔢 <b>Step 3: Quantity</b>\n\nSend the quantity:`,
      { inline_keyboard: [[{ text: "1", callback_data: "od_set_qty:1" }, { text: "2", callback_data: "od_set_qty:2" }, { text: "5", callback_data: "od_set_qty:5" }, { text: "10", callback_data: "od_set_qty:10" }], [{ text: "⬅️ Back", callback_data: "od_search_product" }], [{ text: "❌ Cancel", callback_data: "od_cancel" }]] },
      messageId,
    );
  },

  async odSetQty(ctx: CommandContext, qtyStr: string, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    return this.odAddItemWithQty(ctx, Number(qtyStr), messageId, lang, draft);
  },

  async odHandleQuantityInput(ctx: CommandContext, text: string, lang: string, draft: OrderDraft): Promise<boolean> {
    const qty = Number(text.trim());
    if (!Number.isFinite(qty) || qty <= 0) {
      await TelegramService.sendMessage(ctx.chatId, "❌ Invalid quantity. Send a positive number (e.g. 2).");
      return true;
    }
    await this.odAddItemWithQty(ctx, qty, undefined, lang, draft);
    return true;
  },

  async odAddItemWithQty(ctx: CommandContext, qty: number, messageId: number | undefined, lang: string, draft: OrderDraft) {
    if (!draft.pendingProduct) return TelegramService.sendMessage(ctx.chatId, "❌ No product selected. Use /createorder to restart.");
    draft.items.push({
      productId: draft.pendingProduct.productId,
      productName: draft.pendingProduct.productName,
      sku: draft.pendingProduct.sku,
      quantity: qty,
      unitPrice: draft.pendingProduct.unitPrice,
      unitCost: draft.pendingProduct.unitCost,
      variationId: draft.pendingVariationId,
    });
    draft.pendingProduct = undefined;
    draft.pendingVariationId = undefined;
    draft.step = "add_more";
    TelegramSessionStore.saveOrderDraft(draft);
    const itemsText = draft.items.map((it, i) => `${i + 1}. ${it.productName} (${it.sku}) × ${it.quantity} = ${money((it.unitPrice * qty).toFixed(2))}`).join("\n");
    await this.sendOrEdit(
      ctx,
      `✅ Added to order.\n\n🛒 <b>Current Items:</b>\n${itemsText}\n\n<b>Add another product?</b>`,
      { inline_keyboard: [[{ text: "➕ Add Product", callback_data: "od_search_product" }], [{ text: "➡️ Continue to Shipping", callback_data: "od_add_more:done" }], [{ text: "❌ Cancel", callback_data: "od_cancel" }]] },
      messageId,
    );
  },

  async odAddMore(ctx: CommandContext, action: string, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    if (action === "done") {
      draft.step = "shipping";
      TelegramSessionStore.saveOrderDraft(draft);
      const subtotal = draft.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
      await this.sendOrEdit(
        ctx,
        `🚚 <b>Step 4: Shipping Cost</b>\n\nSubtotal: ${money(subtotal.toFixed(2))}\n\nSend the shipping cost (or 0 for none):`,
        { inline_keyboard: [[{ text: "0 (Free Shipping)", callback_data: "od_set_shipping:0" }], [{ text: "❌ Cancel", callback_data: "od_cancel" }]] },
        messageId,
      );
    }
  },

  async odHandleShippingInput(ctx: CommandContext, text: string, lang: string, draft: OrderDraft): Promise<boolean> {
    const shipping = Number(text.trim());
    if (!Number.isFinite(shipping) || shipping < 0) {
      await TelegramService.sendMessage(ctx.chatId, "❌ Invalid amount. Send a number (e.g. 100 or 0).");
      return true;
    }
    draft.shippingCost = shipping;
    draft.step = "discount";
    TelegramSessionStore.saveOrderDraft(draft);
    const subtotal = draft.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    await TelegramService.sendMessage(
      ctx.chatId,
      `✅ Shipping: ${money(shipping.toFixed(2))}\n\nSubtotal + Shipping: ${money((subtotal + shipping).toFixed(2))}\n\n🏷️ <b>Step 5: Discount</b>\n\nSend the discount amount (or 0 for none):`,
      { inline_keyboard: [[{ text: "0 (No Discount)", callback_data: "od_set_discount:0" }], [{ text: "❌ Cancel", callback_data: "od_cancel" }]] },
    );
    return true;
  },

  async odSetShipping(ctx: CommandContext, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    draft.step = "shipping";
    TelegramSessionStore.saveOrderDraft(draft);
    await TelegramService.sendMessage(ctx.chatId, "Send the shipping cost (or 0 for none):");
  },

  async odSetDiscount(ctx: CommandContext, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    draft.step = "discount";
    TelegramSessionStore.saveOrderDraft(draft);
    await TelegramService.sendMessage(ctx.chatId, "Send the discount amount (or 0 for none):");
  },

  async odHandleDiscountInput(ctx: CommandContext, text: string, lang: string, draft: OrderDraft): Promise<boolean> {
    const discount = Number(text.trim());
    if (!Number.isFinite(discount) || discount < 0) {
      await TelegramService.sendMessage(ctx.chatId, "❌ Invalid amount. Send a number (e.g. 50 or 0).");
      return true;
    }
    draft.discount = discount;
    draft.step = "payment_method";
    TelegramSessionStore.saveOrderDraft(draft);
    await TelegramService.sendMessage(
      ctx.chatId,
      `✅ Discount: ${money(discount.toFixed(2))}\n\n💳 <b>Step 6: Payment Method</b>\n\nSelect payment method:`,
      {
        inline_keyboard: [
          [{ text: "💵 CASH", callback_data: "od_set_payment_method:CASH" }, { text: "📱 bKash", callback_data: "od_set_payment_method:BKASH" }],
          [{ text: "📱 Nagad", callback_data: "od_set_payment_method:NAGAD" }, { text: "🏦 BANK", callback_data: "od_set_payment_method:BANK" }],
          [{ text: "💳 CARD", callback_data: "od_set_payment_method:CARD" }, { text: "OTHER", callback_data: "od_set_payment_method:OTHER" }],
          [{ text: "⏭️ No Payment (Due)", callback_data: "od_set_payment_method:NONE" }],
          [{ text: "❌ Cancel", callback_data: "od_cancel" }],
        ],
      },
    );
    return true;
  },

  async odSetPaymentMethod(ctx: CommandContext, method: string, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    if (method === "NONE") {
      draft.paymentMethod = undefined;
      draft.paymentAmount = 0;
      return this.odShowSummary(ctx, messageId, lang);
    }
    draft.paymentMethod = method;
    draft.step = "payment_amount";
    TelegramSessionStore.saveOrderDraft(draft);
    const subtotal = draft.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const total = subtotal + draft.shippingCost - draft.discount;
    await this.sendOrEdit(
      ctx,
      `💳 Payment Method: <b>${method}</b>\n\n💰 <b>Step 7: Payment Amount</b>\n\nOrder Total: ${money(total.toFixed(2))}\n\nSend the amount the customer paid (or 0 for due):`,
      { inline_keyboard: [[{ text: `Full (${money(total.toFixed(2))})`, callback_data: `od_set_payment_amount:${total}` }], [{ text: "0 (Due)", callback_data: "od_set_payment_amount:0" }], [{ text: "❌ Cancel", callback_data: "od_cancel" }]] },
      messageId,
    );
  },

  async odHandlePaymentAmountInput(ctx: CommandContext, text: string, lang: string, draft: OrderDraft): Promise<boolean> {
    const amount = Number(text.trim());
    if (!Number.isFinite(amount) || amount < 0) {
      await TelegramService.sendMessage(ctx.chatId, "❌ Invalid amount. Send a number.");
      return true;
    }
    draft.paymentAmount = amount;
    TelegramSessionStore.saveOrderDraft(draft);
    await this.odShowSummary(ctx, undefined, lang);
    return true;
  },

  async odSetPaymentAmount(ctx: CommandContext, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    draft.step = "payment_amount";
    TelegramSessionStore.saveOrderDraft(draft);
    await TelegramService.sendMessage(ctx.chatId, "Send the payment amount:");
  },

  async odShowSummary(ctx: CommandContext, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    if (!draft.customerId || draft.items.length === 0) {
      return TelegramService.sendMessage(ctx.chatId, "❌ Draft incomplete. Use /createorder to restart.");
    }
    draft.step = "confirm";
    TelegramSessionStore.saveOrderDraft(draft);
    const subtotal = draft.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const total = subtotal + draft.shippingCost - draft.discount;
    const due = total - (draft.paymentAmount ?? 0);
    const itemsText = draft.items.map((it, i) => `${i + 1}. ${it.productName} (${it.sku}) × ${it.quantity} = ${money((it.unitPrice * it.quantity).toFixed(2))}`).join("\n");
    const summary =
      `📋 <b>Order Summary</b>\n\n` +
      `👤 Customer: ${draft.customerName} (${draft.customerPhone})\n\n` +
      `📦 Items:\n${itemsText}\n\n` +
      `Subtotal: ${money(subtotal.toFixed(2))}\n` +
      `Shipping: ${money(draft.shippingCost.toFixed(2))}\n` +
      `Discount: -${money(draft.discount.toFixed(2))}\n` +
      `─────────────\n` +
      `<b>Total: ${money(total.toFixed(2))}</b>\n\n` +
      `Payment: ${draft.paymentMethod ? money((draft.paymentAmount ?? 0).toFixed(2)) + " (" + draft.paymentMethod + ")" : "None (Due)"}\n` +
      `Due: ${money(due.toFixed(2))}\n\n` +
      `Confirm to create the order?`;
    await this.sendOrEdit(
      ctx,
      summary,
      {
        inline_keyboard: [
          [{ text: "✅ Confirm & Create", callback_data: "od_confirm" }],
          [{ text: "❌ Cancel", callback_data: "od_cancel" }],
        ],
      },
      messageId,
    );
  },

  async odConfirm(ctx: CommandContext, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    if (!draft.customerId || draft.items.length === 0) {
      return TelegramService.sendMessage(ctx.chatId, "❌ Draft incomplete. Use /createorder to restart.");
    }
    try {
      const order = await OrderService.create({
        customerId: draft.customerId,
        status: "CONFIRMED",
        shippingCost: draft.shippingCost,
        discount: draft.discount,
        items: draft.items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
        payment: draft.paymentMethod && draft.paymentAmount && draft.paymentAmount > 0
          ? { amount: draft.paymentAmount, method: draft.paymentMethod }
          : undefined,
        createdBy: ctx.user?.id,
      } as any);
      TelegramSessionStore.clearOrderDraft(ctx.telegramUserId, ctx.chatId);
      const total = (order as any)?.total ?? 0;
      await this.sendOrEdit(
        ctx,
        `✅ <b>Order Created!</b>\n\nOrder #: <b>${(order as any)?.orderNumber ?? "—"}</b>\nTotal: ${money(Number(total).toFixed(2))}\nCustomer: ${draft.customerName}\n\nUse /receivepayment to record additional payments.\nUse /order ${(order as any)?.id ?? ""} to view details.`,
        { inline_keyboard: [[{ text: "📦 View Order", callback_data: `order_view:${(order as any)?.id ?? ""}` }], [{ text: "🏠 Menu", callback_data: "menu" }]] },
        messageId,
      );
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ Failed to create order: ${(e as Error).message}`);
    }
  },

  async odCancel(ctx: CommandContext, messageId: number | undefined, lang: string) {
    TelegramSessionStore.clearOrderDraft(ctx.telegramUserId, ctx.chatId);
    await this.sendOrEdit(ctx, "❌ Order creation cancelled.", { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] }, messageId);
  },

  async odRemoveItem(ctx: CommandContext, indexStr: string, messageId: number | undefined, lang: string) {
    const draft = TelegramSessionStore.getOrderDraft(ctx.telegramUserId, ctx.chatId);
    if (!draft) return this.sessionExpired(ctx, messageId);
    const idx = Number(indexStr);
    if (Number.isFinite(idx) && idx >= 0 && idx < draft.items.length) {
      draft.items.splice(idx, 1);
      TelegramSessionStore.saveOrderDraft(draft);
    }
    return this.odShowSummary(ctx, messageId, lang);
  },

  sessionExpired(ctx: CommandContext, messageId: number | undefined) {
    TelegramSessionStore.clearOrderDraft(ctx.telegramUserId, ctx.chatId);
    return this.sendOrEdit(ctx, "⏰ Session expired. Use /createorder to start again.", { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] }, messageId);
  },

  // ────────────────────────────────────────────────────────────────
  // NEW: /createorder, /updateorder, /cancelorder, /returnorder —
  // raw-pipe commands. Designed for fast one-line order entry from the
  // phone; the alternative would be a multi-step form which is heavier
  // to implement.
  // ────────────────────────────────────────────────────────────────
  // /createorder PHONE|SKU:QTY,SKU:QTY|PAYMENT_METHOD|SHIPPING?
  // OR /createorder (no args) → interactive multi-step flow
  async cmdCreateOrder(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "orders:create")) return this.deny(ctx, lang);
    // If no args → start the interactive multi-step flow.
    if (!raw.trim()) {
      return this.startInteractiveOrder(ctx, lang);
    }
    // Legacy pipe syntax (power users)
    const parts = raw.split("|").map((s: string) => s.trim());
    if (parts.length < 3) {
      return TelegramService.sendMessage(ctx.chatId, "Usage: /createorder PHONE | SKU:QTY,SKU:QTY | PAYMENT_METHOD | SHIPPING_COST?\n\nPAYMENT_METHOD: CASH, BKASH, NAGAD, BANK, CARD, OTHER\n\nOr send /createorder with no args for the interactive flow.");
    }
    const [phone, itemsRaw, method, shippingStr] = parts;
    if (!phone || !itemsRaw || !method) return TelegramService.sendMessage(ctx.chatId, "❌ Missing phone, items, or payment method.");

    // Resolve customer by phone
    let customer = await db.customer.findUnique({ where: { phone } });
    if (!customer) {
      customer = await db.customer.create({ data: { name: `Customer ${phone}`, phone } });
    }

    // Parse items: "SKU:QTY,SKU:QTY" → [{ productId, quantity }]
    const itemPairs = itemsRaw.split(",").map((p: string) => p.trim().split(":")).filter((p: string[]) => p.length === 2);
    if (!itemPairs.length) return TelegramService.sendMessage(ctx.chatId, "❌ Items must be SKU:QTY,SKU:QTY format.");
    const items: { productId: string; quantity: number }[] = [];
    for (const [sku, qtyStr] of itemPairs) {
      const product = await db.product.findUnique({ where: { sku } });
      if (!product) return TelegramService.sendMessage(ctx.chatId, `❌ Product not found: ${sku}`);
      const qty = Number(qtyStr);
      if (!Number.isFinite(qty) || qty <= 0) return TelegramService.sendMessage(ctx.chatId, `❌ Invalid quantity for ${sku}: ${qtyStr}`);
      items.push({ productId: product.id, quantity: qty });
    }

    const shippingCost = shippingStr ? Number(shippingStr) : 0;
    const order = await OrderService.create({
      customerId: customer.id,
      status: "CONFIRMED",
      shippingCost,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      payment: method ? { amount: 0, method: method.toUpperCase() } : undefined,
      createdBy: ctx.user?.id,
    } as any);
    await TelegramService.sendMessage(ctx.chatId, `✅ Order created: <b>${(order as any)?.orderNumber ?? "—"}</b>\nTotal: ${money((order as any)?.total?.toFixed?.(2) ?? "0")}\nCustomer: ${customer.name}`);
  },

  async cmdUpdateOrder(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "orders:update")) return this.deny(ctx, lang);
    const [orderId, status] = raw.split("|").map((s: string) => s.trim());
    if (!orderId || !status) return TelegramService.sendMessage(ctx.chatId, "Usage: /updateorder ORDER_ID | NEW_STATUS\n\nStatus: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED");
    await OrderService.updateStatus(orderId, status.toUpperCase());
    await TelegramService.sendMessage(ctx.chatId, `✅ Order ${orderId} → ${status.toUpperCase()}`);
  },

  async cmdCancelOrder(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "orders:cancel")) return this.deny(ctx, lang);
    const orderId = raw.trim();
    if (!orderId) return TelegramService.sendMessage(ctx.chatId, "Usage: /cancelorder ORDER_ID");
    await OrderService.updateStatus(orderId, "CANCELLED", "Cancelled via Telegram");
    await TelegramService.sendMessage(ctx.chatId, `✅ Order ${orderId} cancelled. Stock restored.`);
  },

  async cmdReturnOrder(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "returns:create")) return this.deny(ctx, lang);
    const [orderId, type, reason] = raw.split("|").map((s: string) => s.trim());
    if (!orderId) return TelegramService.sendMessage(ctx.chatId, "Usage: /returnorder ORDER_ID | TYPE? | REASON?\n\nTYPE: RETURN (default) | EXCHANGE\n\nCreates a PENDING return request. An admin must approve it (via web dashboard or /approvereturn) to apply stock movement + refund.");
    const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return TelegramService.sendMessage(ctx.chatId, "❌ Order not found.");
    // ── Use ReturnService.request (NOT direct db.return.create) ──
    // This enforces:
    //   - validates the order is in a returnable state (SHIPPED/DELIVERED/COMPLETED)
    //   - validates returned quantities ≤ ordered − already-returned
    //   - transitions the order to RETURN_REQUESTED via the state machine
    //   - writes RETURN_REQUEST audit log
    // Stock movement + refund are NOT applied here — they happen when an
    // admin calls /approvereturn (which calls ReturnService.approve).
    try {
      const ret = await ReturnService.request({
        orderId: order.id,
        type: (type || "RETURN").toUpperCase(),
        reason: reason || "Returned via Telegram",
        items: order.items.map((it: any) => ({ productId: it.productId, quantity: it.quantity, condition: "GOOD" as const })),
        createdBy: ctx.user?.id,
      });
      await TelegramService.sendMessage(ctx.chatId,
        `✅ Return request created: <b>${ret.id}</b>\n` +
        `Order: ${order.orderNumber}\n` +
        `Type: ${ret.type}\n` +
        `Items: ${ret.items.length}\n\n` +
        `Status: PENDING — an admin must approve this return to apply stock movement and issue any refund.\n` +
        `Use: /approvereturn ${ret.id}`
      );
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  // ── NEW: /approvereturn RETURN_ID — approve a PENDING return ──
  // Applies the stock movement (RETURN or DAMAGED_RETURN) and creates the
  // refund (if refundAmount > 0). Transitions the return PENDING → COMPLETED
  // and the order → RETURNED if all items are returned.
  async cmdApproveReturn(ctx: CommandContext, args: string[], lang: string) {
    if (!this.can(ctx, "returns:update")) return this.deny(ctx, lang);
    const returnId = args[0]?.trim();
    if (!returnId) return TelegramService.sendMessage(ctx.chatId, "Usage: /approvereturn RETURN_ID\n\nApproves a PENDING return: applies stock movement + refund, transitions order to RETURNED if all items returned.");
    try {
      const ret = await ReturnService.approve(returnId);
      await TelegramService.sendMessage(ctx.chatId, `✅ Return ${ret.id} approved.\nStatus: ${ret.status}\n\nStock movements applied. Refund (if any) recorded against the order.`);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  // ── NEW: /refund ORDER_ID | AMOUNT | METHOD | REF? ──
  // Records a standalone refund (not tied to a return). Uses RefundService
  // which validates amount ≤ paidAmount and re-persists the profitability
  // snapshot.
  async cmdRefund(ctx: CommandContext, args: string[], lang: string) {
    if (!this.can(ctx, "payments:refund")) return this.deny(ctx, lang);
    const [orderId, amountStr, method, ref] = args.join(" ").split("|").map((s: string) => s.trim());
    if (!orderId || !amountStr) {
      return TelegramService.sendMessage(ctx.chatId, "Usage: /refund ORDER_ID | AMOUNT | METHOD? | REFERENCE?\n\nRecords a refund against the order. Method defaults to CASH.");
    }
    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) return TelegramService.sendMessage(ctx.chatId, "❌ Invalid amount.");
    try {
      const { RefundService } = await import("./return");
      const refund = await RefundService.create({
        orderId,
        amount,
        method: method || "CASH",
        transactionReference: ref || undefined,
        createdBy: ctx.user?.id,
      });
      const order = await db.order.findUnique({ where: { id: orderId } });
      await TelegramService.sendMessage(ctx.chatId,
        `✅ Refund recorded: <b>${refund.id}</b>\n` +
        `Order: ${order?.orderNumber ?? orderId}\n` +
        `Amount: ${money(amount.toFixed(2))}\n` +
        `Method: ${refund.method}\n` +
        `Order Payment Status: ${order?.paymentStatus ?? "—"}`
      );
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  // ── NEW: /addcustomer Name | Phone | Email? | City? ──
  async cmdAddCustomer(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "customers:create")) return this.deny(ctx, lang);
    const [name, phone, email, city] = raw.split("|").map((s: string) => s.trim());
    if (!name || !phone) return TelegramService.sendMessage(ctx.chatId, "Usage: /addcustomer Name | Phone | Email? | City?");
    try {
      const existing = await db.customer.findUnique({ where: { phone } });
      if (existing) return TelegramService.sendMessage(ctx.chatId, `❌ Customer already exists: ${existing.name} (${existing.phone})`);
      const c = await db.customer.create({ data: { name, phone, email: email || undefined, city: city || undefined } });
      await AuditService.log({ userId: ctx.user?.id, action: "CUSTOMER_CREATE", entity: "Customer", entityId: c.id, changes: { name, phone }, source: "TELEGRAM" } as any);
      await TelegramService.sendMessage(ctx.chatId, `✅ Customer created: <b>${c.name}</b>\nPhone: ${c.phone}${email ? `\nEmail: ${email}` : ""}${city ? `\nCity: ${city}` : ""}`);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  // ── NEW: /updatecustomer ID | Name? | Phone? | Email? | City? ──
  async cmdUpdateCustomer(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "customers:update")) return this.deny(ctx, lang);
    const [id, name, phone, email, city] = raw.split("|").map((s: string) => s.trim());
    if (!id) return TelegramService.sendMessage(ctx.chatId, "Usage: /updatecustomer ID | Name? | Phone? | Email? | City?\n\nLeave a field blank to keep the existing value.");
    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) return TelegramService.sendMessage(ctx.chatId, "❌ Customer not found.");
    const data: any = {};
    if (name) data.name = name;
    if (phone) data.phone = phone;
    if (email) data.email = email;
    if (city) data.city = city;
    const updated = await db.customer.update({ where: { id }, data });
    await TelegramService.sendMessage(ctx.chatId, `✅ Customer updated: ${updated.name} (${updated.phone})`);
  },

  // ── NEW: /updateproduct ID | SellingPrice? | PurchasePrice? | Status? ──
  async cmdUpdateProduct(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "products:update")) return this.deny(ctx, lang);
    const [id, sellStr, purchaseStr, status] = raw.split("|").map((s: string) => s.trim());
    if (!id) return TelegramService.sendMessage(ctx.chatId, "Usage: /updateproduct ID | SellingPrice? | PurchasePrice? | Status?\n\nStatus: ACTIVE | INACTIVE");
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) return TelegramService.sendMessage(ctx.chatId, "❌ Product not found.");
    const data: any = {};
    if (sellStr) data.sellingPrice = Number(sellStr);
    if (purchaseStr) data.purchasePrice = Number(purchaseStr);
    if (status) data.status = status.toUpperCase();
    await db.product.update({ where: { id }, data });
    // Push price/status update to WooCommerce (fire-and-forget).
    if (existing.externalId && (data.sellingPrice !== undefined || data.status !== undefined)) {
      const { WooCommerceService } = await import("./woocommerce");
      void WooCommerceService.pushProductUpdate(id, { sellingPrice: data.sellingPrice, status: data.status }).catch(() => {});
    }
    await TelegramService.sendMessage(ctx.chatId, `✅ Product updated: ${existing.name} (${existing.sku})`);
  },

  // ── NEW: /updatecategory ID | Name? | Description? ──
  async cmdUpdateCategory(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "categories:update")) return this.deny(ctx, lang);
    const [id, name, description] = raw.split("|").map((s: string) => s.trim());
    if (!id) return TelegramService.sendMessage(ctx.chatId, "Usage: /updatecategory ID | Name? | Description?");
    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) return TelegramService.sendMessage(ctx.chatId, "❌ Category not found.");
    const data: any = {};
    if (name) data.name = name;
    if (description) data.description = description;
    await db.category.update({ where: { id }, data });
    await TelegramService.sendMessage(ctx.chatId, `✅ Category updated: ${existing.name}`);
  },

  // ── NEW: /updatesupplier ID | Name? | Phone? | Email? | Address? ──
  async cmdUpdateSupplier(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "suppliers:update")) return this.deny(ctx, lang);
    const [id, name, phone, email, address] = raw.split("|").map((s: string) => s.trim());
    if (!id) return TelegramService.sendMessage(ctx.chatId, "Usage: /updatesupplier ID | Name? | Phone? | Email? | Address?");
    const existing = await db.supplier.findUnique({ where: { id } });
    if (!existing) return TelegramService.sendMessage(ctx.chatId, "❌ Supplier not found.");
    const data: any = {};
    if (name) data.name = name;
    if (phone) data.phone = phone;
    if (email) data.email = email;
    if (address) data.address = address;
    await db.supplier.update({ where: { id }, data });
    await TelegramService.sendMessage(ctx.chatId, `✅ Supplier updated: ${existing.name}`);
  },

  // ── NEW: /createpurchase SupplierID | SKU:QTY:COST,SKU:QTY:COST | PaidAmount? | ShippingCost? ──
  async cmdCreatePurchase(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "purchases:create")) return this.deny(ctx, lang);
    const parts = raw.split("|").map((s: string) => s.trim());
    if (parts.length < 2) {
      return TelegramService.sendMessage(ctx.chatId,
        "Usage: /createpurchase SupplierID | SKU:QTY:COST,SKU:QTY:COST | PaidAmount? | ShippingCost?\n\n" +
        "Example: /createpurchase SUP-1001 | IPH13:10:95000,IPHCASE:50:120 | 500000 | 2000"
      );
    }
    const [supplierId, itemsRaw, paidStr, shippingStr] = parts;
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return TelegramService.sendMessage(ctx.chatId, "❌ Supplier not found.");
    // Parse items: "SKU:QTY:COST,SKU:QTY:COST"
    const items: { productId: string; quantity: number; unitCost?: number }[] = [];
    for (const pair of itemsRaw.split(",").map((s: string) => s.trim())) {
      const [sku, qtyStr, costStr] = pair.split(":").map((s: string) => s.trim());
      const product = await db.product.findUnique({ where: { sku } });
      if (!product) return TelegramService.sendMessage(ctx.chatId, `❌ Product not found: ${sku}`);
      const qty = Number(qtyStr);
      if (!Number.isFinite(qty) || qty <= 0) return TelegramService.sendMessage(ctx.chatId, `❌ Invalid quantity for ${sku}: ${qtyStr}`);
      items.push({ productId: product.id, quantity: qty, unitCost: costStr ? Number(costStr) : undefined });
    }
    try {
      const purchase = await PurchaseService.create({
        supplierId: supplier.id,
        items,
        paidAmount: paidStr ? Number(paidStr) : 0,
        shippingCost: shippingStr ? Number(shippingStr) : 0,
        receive: true,
        createdBy: ctx.user?.id,
      } as any);
      await TelegramService.sendMessage(ctx.chatId,
        `✅ Purchase created: <b>${(purchase as any)?.purchaseNumber ?? "—"}</b>\n` +
        `Total: ${money(Number((purchase as any)?.total ?? 0).toFixed(2))}\n` +
        `Paid: ${money(Number((purchase as any)?.paidAmount ?? 0).toFixed(2))}\n` +
        `Due: ${money(Number((purchase as any)?.dueAmount ?? 0).toFixed(2))}\n` +
        `Stock received + WAC recomputed.`
      );
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  // ── NEW: /receivepurchase PurchaseID ──
  async cmdReceivePurchase(ctx: CommandContext, args: string[], lang: string) {
    if (!this.can(ctx, "purchases:update")) return this.deny(ctx, lang);
    const purchaseId = args[0]?.trim();
    if (!purchaseId) return TelegramService.sendMessage(ctx.chatId, "Usage: /receivepurchase PurchaseID\n\nReceives a pending purchase — increases stock + recomputes WAC.");
    try {
      await PurchaseService.receive(purchaseId);
      await TelegramService.sendMessage(ctx.chatId, `✅ Purchase ${purchaseId} received. Stock increased + WAC recomputed.`);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  async cmdCash(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "reports:read")) return this.deny(ctx, lang);
    const summary = await CashService.summary();
    const text = `<b>💰 Cash Register</b>\n\nOpening: ${summary.openingBalance}\n+ Cash Sales: ${summary.cashSales}\n+ Customer Payments: ${summary.customerPayments}\n− Refunds: ${summary.refunds}\n− Expenses: ${summary.expenses}\n= Closing: ${summary.closingBalance}`;
    await TelegramService.sendMessage(ctx.chatId, text);
  },

  // --- Deliveries: list, view, change status ---
  async cmdDeliveries(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "deliveries:read")) return this.deny(ctx, lang);
    await this.paginateDeliveries(ctx, 1, undefined, lang);
  },
  async paginateDeliveries(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "deliveries:read")) return this.deny(ctx, lang);
    const { items, total } = await DeliveryService.list({ page, limit: 5 });
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>🚚 Deliveries</b> (${total})\n\n` + items.map((d: any) => `• ${d.order?.orderNumber ?? d.orderId}: ${d.status}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((d: any) => [{ text: `🚚 ${d.order?.orderNumber ?? d.orderId} (${d.status})`, callback_data: `delivery_view:${d.id}` }]);
    rows.push(this.paginationRow(page, totalPages, "deliveries_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async viewDelivery(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "deliveries:read")) return this.deny(ctx, lang);
    const d: any = await DeliveryService.get(id);
    if (!d) return TelegramService.sendMessage(ctx.chatId, "Delivery not found");
    const text = `<b>🚚 ${d.order?.orderNumber ?? d.orderId}</b>\nStatus: <b>${d.status}</b>\nCourier: ${d.courierName ?? d.courierProvider?.name ?? "—"}\nTracking: ${d.trackingNumber ?? "—"}\nRecipient: ${d.recipientName ?? "—"} · ${d.recipientPhone ?? "—"}\nCOD: ${money(d.codAmount)}`;
    const rows: any[][] = [];
    if (this.can(ctx, "deliveries:update")) rows.push([{ text: "🔄 Change Status", callback_data: `delivery_status_menu:${d.id}` }]);
    rows.push([{ text: "⬅️ Back", callback_data: "deliveries_page:1" }]);
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async deliveryStatusMenu(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "deliveries:update")) return this.deny(ctx, lang);
    const statuses = ["PENDING", "PACKED", "SHIPPED", "IN_TRANSIT", "DELIVERED", "FAILED", "RETURNED"];
    const rows: any[][] = statuses.map((s) => [{ text: s, callback_data: `delivery_status_set:${id}|${s}` }]);
    rows.push([{ text: "⬅️ Back", callback_data: `delivery_view:${id}` }]);
    await this.sendOrEdit(ctx, "Select new delivery status:", { inline_keyboard: rows }, messageId);
  },
  async confirmDeliveryStatusPrompt(ctx: CommandContext, id: string, status: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "deliveries:update")) return this.deny(ctx, lang);
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: `delivery_status_confirm:${id}|${status}` },
      { text: this.t("no", lang), callback_data: `delivery_view:${id}` },
    ]] };
    await this.sendOrEdit(ctx, `${this.t("confirm", lang)} Set delivery status to <b>${status}</b>?`, kb, messageId);
  },
  async confirmDeliveryStatus(ctx: CommandContext, id: string, status: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "deliveries:update")) return this.deny(ctx, lang);
    try {
      await DeliveryService.updateStatus(id, status, `Via Telegram by ${ctx.user?.firstName ?? ctx.telegramUserId}`);
      await this.sendOrEdit(ctx, `${this.t("done", lang)} Delivery status set to <b>${status}</b>.`, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: `delivery_view:${id}` }]] }, messageId);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  // --- Returns: list, view ---
  async cmdReturns(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "returns:read")) return this.deny(ctx, lang);
    await this.paginateReturns(ctx, 1, undefined, lang);
  },
  async paginateReturns(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "returns:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.return.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 5, take: 5, include: { customer: { select: { name: true } }, order: { select: { orderNumber: true } } } }),
      db.return.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>↩️ Returns</b> (${total})\n\n` + items.map((r) => `• ${r.order.orderNumber} — ${r.customer.name}: ${r.status}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((r) => [{ text: `↩️ ${r.order.orderNumber} (${r.status})`, callback_data: `return_view:${r.id}` }]);
    rows.push(this.paginationRow(page, totalPages, "returns_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async viewReturn(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "returns:read")) return this.deny(ctx, lang);
    const r = await db.return.findUnique({ where: { id }, include: { customer: true, order: { select: { orderNumber: true } }, items: { include: { product: { select: { name: true } } } } } });
    if (!r) return TelegramService.sendMessage(ctx.chatId, "Return not found");
    const itemsText = r.items.map((i) => `  · ${i.product.name} × ${i.quantity}`).join("\n");
    const text = `<b>↩️ Return — ${r.order.orderNumber}</b>\nCustomer: ${r.customer.name}\nType: ${r.type}\nStatus: <b>${r.status}</b>\nReason: ${r.reason ?? "—"}\nRefund: ${money(r.refundAmount)}\n\n${itemsText}`;
    await this.sendOrEdit(ctx, text, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "returns_page:1" }]] }, messageId);
  },

  // --- Purchases: list, view, mark received ---
  async cmdPurchases(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "purchases:read")) return this.deny(ctx, lang);
    await this.paginatePurchases(ctx, 1, undefined, lang);
  },
  async paginatePurchases(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "purchases:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.purchase.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 5, take: 5, include: { supplier: { select: { name: true } } } }),
      db.purchase.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>🛒 Purchases</b> (${total})\n\n` + items.map((p) => `• ${p.purchaseNumber} — ${p.supplier.name}: ${money(p.total)} (${p.status})`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((p) => [{ text: `🛒 ${p.purchaseNumber} (${p.status})`, callback_data: `purchase_view:${p.id}` }]);
    rows.push(this.paginationRow(page, totalPages, "purchases_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async viewPurchase(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "purchases:read")) return this.deny(ctx, lang);
    const p = await db.purchase.findUnique({ where: { id }, include: { supplier: true, items: { include: { product: { select: { name: true } } } } } });
    if (!p) return TelegramService.sendMessage(ctx.chatId, "Purchase not found");
    const itemsText = p.items.map((i) => `  · ${i.product.name} × ${i.quantity}`).join("\n");
    const text = `<b>🛒 ${p.purchaseNumber}</b>\nSupplier: ${p.supplier.name}\nStatus: <b>${p.status}</b>\nTotal: ${money(p.total)} · Paid: ${money(p.paidAmount)} · Due: ${money(p.dueAmount)}\n\n${itemsText}`;
    const rows: any[][] = [];
    if (p.status === "PENDING" && this.can(ctx, "purchases:update")) rows.push([{ text: "✅ Mark Received", callback_data: `purchase_receive:${p.id}` }]);
    rows.push([{ text: "⬅️ Back", callback_data: "purchases_page:1" }]);
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async receivePurchasePrompt(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "purchases:update")) return this.deny(ctx, lang);
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: `purchase_receive_confirm:${id}` },
      { text: this.t("no", lang), callback_data: `purchase_view:${id}` },
    ]] };
    await this.sendOrEdit(ctx, `${this.t("confirm", lang)} Mark this purchase as received? This will add the items to inventory.`, kb, messageId);
  },
  async confirmReceivePurchase(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "purchases:update")) return this.deny(ctx, lang);
    try {
      await PurchaseService.receive(id);
      await this.sendOrEdit(ctx, `${this.t("done", lang)} Purchase received and stock updated.`, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: `purchase_view:${id}` }]] }, messageId);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  // --- Suppliers: list, view, add ---
  async cmdSuppliers(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "suppliers:read")) return this.deny(ctx, lang);
    await this.paginateSuppliers(ctx, 1, undefined, lang);
  },
  async paginateSuppliers(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "suppliers:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.supplier.findMany({ orderBy: { name: "asc" }, skip: (page - 1) * 5, take: 5, include: { _count: { select: { purchases: true } } } }),
      db.supplier.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>🏭 Suppliers</b> (${total})\n\n` + items.map((s) => `• ${s.name}${s.phone ? " · " + s.phone : ""}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((s) => [{ text: `🏭 ${s.name}`, callback_data: `supplier_view:${s.id}` }]);
    rows.push(this.paginationRow(page, totalPages, "suppliers_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async viewSupplier(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "suppliers:read")) return this.deny(ctx, lang);
    const s = await db.supplier.findUnique({ where: { id }, include: { _count: { select: { purchases: true } } } });
    if (!s) return TelegramService.sendMessage(ctx.chatId, "Supplier not found");
    const text = `<b>🏭 ${s.name}</b>\n📞 ${s.phone ?? "—"}\n📧 ${s.email ?? "—"}\n🏢 ${s.company ?? "—"}\n📍 ${s.address ?? "—"}\nPurchases: ${s._count.purchases}`;
    await this.sendOrEdit(ctx, text, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "suppliers_page:1" }]] }, messageId);
  },
  // /addsupplier Name | phone | email | address(optional)
  async cmdAddSupplier(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "suppliers:create")) return this.deny(ctx, lang);
    const usage = "Usage:\n<code>/addsupplier Name | phone | email | address(optional)</code>";
    if (!raw) return TelegramService.sendMessage(ctx.chatId, usage);
    const [name, phone, email, address] = raw.split("|").map((p) => p.trim());
    if (!name || name.length < 2) return TelegramService.sendMessage(ctx.chatId, "❌ Name must be at least 2 characters.");
    const s = await db.supplier.create({ data: { name, phone: phone || undefined, email: email || undefined, address: address || undefined } });
    await AuditService.log({ userId: ctx.user?.id ?? null, action: "SUPPLIER_CREATE", entity: "Supplier", entityId: s.id, changes: { name, via: "telegram" } });
    await TelegramService.sendMessage(ctx.chatId, `✅ Supplier created: <b>${s.name}</b>`);
  },

  // --- Warehouses: list, view, toggle, add ---
  async cmdWarehouses(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "warehouses:read")) return this.deny(ctx, lang);
    await this.paginateWarehouses(ctx, 1, undefined, lang);
  },
  async paginateWarehouses(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "warehouses:read")) return this.deny(ctx, lang);
    const all = await WarehouseService.list();
    const total = all.length;
    const items = all.slice((page - 1) * 5, page * 5);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>🏪 Warehouses</b> (${total})\n\n` + items.map((w: any) => `• ${w.name} (${w.code})${w.isDefault ? " · default" : ""}${w.isActive ? "" : " · inactive"}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((w: any) => [{ text: `${w.isActive ? "🟢" : "⚪"} ${w.name}`, callback_data: `warehouse_view:${w.id}` }]);
    rows.push(this.paginationRow(page, totalPages, "warehouses_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async viewWarehouse(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "warehouses:read")) return this.deny(ctx, lang);
    const w = await db.warehouse.findUnique({ where: { id }, include: { _count: { select: { warehouseStock: true } } } });
    if (!w) return TelegramService.sendMessage(ctx.chatId, "Warehouse not found");
    const text = `<b>🏪 ${w.name}</b>\nCode: ${w.code}\nAddress: ${w.address ?? "—"}\nStatus: ${w.isActive ? "🟢 Active" : "⚪ Inactive"}${w.isDefault ? " (default)" : ""}\nSKUs stocked: ${w._count.warehouseStock}`;
    const rows: any[][] = [];
    if (this.can(ctx, "warehouses:update") && !w.isDefault) rows.push([{ text: w.isActive ? "⛔ Deactivate" : "✅ Activate", callback_data: `warehouse_toggle:${w.id}` }]);
    rows.push([{ text: "⬅️ Back", callback_data: "warehouses_page:1" }]);
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async confirmWarehouseTogglePrompt(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "warehouses:update")) return this.deny(ctx, lang);
    const w = await db.warehouse.findUnique({ where: { id } });
    if (!w) return;
    const next = w.isActive ? "inactive" : "active";
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: `warehouse_toggle_confirm:${id}|${next}` },
      { text: this.t("no", lang), callback_data: `warehouse_view:${id}` },
    ]] };
    await this.sendOrEdit(ctx, `${this.t("confirm", lang)} ${w.isActive ? "Deactivate" : "Activate"} <b>${w.name}</b>?`, kb, messageId);
  },
  async confirmWarehouseToggle(ctx: CommandContext, id: string, next: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "warehouses:update")) return this.deny(ctx, lang);
    try {
      const w = await WarehouseService.update(id, { isActive: next === "active" });
      await this.sendOrEdit(ctx, `${this.t("done", lang)} <b>${w.name}</b> is now ${w.isActive ? "🟢 active" : "⚪ inactive"}.`, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: `warehouse_view:${id}` }]] }, messageId);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },
  // /addwarehouse Name | Code | Address(optional)
  async cmdAddWarehouse(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "warehouses:create")) return this.deny(ctx, lang);
    const usage = "Usage:\n<code>/addwarehouse Name | Code | Address(optional)</code>";
    if (!raw) return TelegramService.sendMessage(ctx.chatId, usage);
    const [name, code, address] = raw.split("|").map((p) => p.trim());
    if (!name || !code) return TelegramService.sendMessage(ctx.chatId, usage);
    const w = await WarehouseService.create({ name, code: code.toUpperCase(), address: address || undefined });
    await TelegramService.sendMessage(ctx.chatId, `✅ Warehouse created: <b>${w.name}</b> (${w.code})`);
  },

  // --- Stock Transfers: list, view, create ---
  async cmdTransfers(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "stock_transfers:read")) return this.deny(ctx, lang);
    await this.paginateTransfers(ctx, 1, undefined, lang);
  },
  async paginateTransfers(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "stock_transfers:read")) return this.deny(ctx, lang);
    const { items, total } = await StockTransferService.list({ page, limit: 5 });
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>🔀 Stock Transfers</b> (${total})\n\n` + items.map((t: any) => `• ${t.transferNumber}: ${t.fromWarehouse.name} → ${t.toWarehouse.name} (${t.status})`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((t: any) => [{ text: `🔀 ${t.transferNumber}`, callback_data: `transfer_view:${t.id}` }]);
    rows.push(this.paginationRow(page, totalPages, "transfers_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async viewTransfer(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "stock_transfers:read")) return this.deny(ctx, lang);
    const t = await db.stockTransfer.findUnique({ where: { id }, include: { fromWarehouse: true, toWarehouse: true, items: { include: { product: { select: { name: true } } } } } });
    if (!t) return TelegramService.sendMessage(ctx.chatId, "Transfer not found");
    const itemsText = t.items.map((i) => `  · ${i.product.name} × ${i.quantity}`).join("\n");
    const text = `<b>🔀 ${t.transferNumber}</b>\n${t.fromWarehouse.name} → ${t.toWarehouse.name}\nStatus: <b>${t.status}</b>\n\n${itemsText}`;
    await this.sendOrEdit(ctx, text, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "transfers_page:1" }]] }, messageId);
  },
  // /transfer FROM_CODE | TO_CODE | PRODUCT_SKU | QTY
  async cmdCreateTransfer(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "stock_transfers:create")) return this.deny(ctx, lang);
    const usage = "Usage:\n<code>/transfer FROM_CODE | TO_CODE | PRODUCT_SKU | QTY</code>";
    if (!raw) return TelegramService.sendMessage(ctx.chatId, usage);
    const [fromCode, toCode, sku, qtyStr] = raw.split("|").map((p) => p.trim());
    if (!fromCode || !toCode || !sku || !qtyStr) return TelegramService.sendMessage(ctx.chatId, usage);
    const [fromWh, toWh, product] = await Promise.all([
      db.warehouse.findUnique({ where: { code: fromCode.toUpperCase() } }),
      db.warehouse.findUnique({ where: { code: toCode.toUpperCase() } }),
      db.product.findUnique({ where: { sku } }),
    ]);
    if (!fromWh) return TelegramService.sendMessage(ctx.chatId, `❌ No warehouse with code ${fromCode}`);
    if (!toWh) return TelegramService.sendMessage(ctx.chatId, `❌ No warehouse with code ${toCode}`);
    if (!product) return TelegramService.sendMessage(ctx.chatId, `❌ No product with SKU ${sku}`);
    const qty = Number(qtyStr);
    if (!Number.isFinite(qty) || qty <= 0) return TelegramService.sendMessage(ctx.chatId, "❌ Quantity must be a positive number.");
    const t = await StockTransferService.create({ fromWarehouseId: fromWh.id, toWarehouseId: toWh.id, notes: `Via Telegram by ${ctx.user?.firstName ?? ctx.telegramUserId}`, items: [{ productId: product.id, quantity: qty }] });
    await TelegramService.sendMessage(ctx.chatId, `✅ Transfer <b>${t.transferNumber}</b> created: ${qty} × ${product.name} from ${fromWh.name} to ${toWh.name}.`);
  },

  // --- Categories: list, add ---
  async cmdCategories(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "categories:read")) return this.deny(ctx, lang);
    await this.paginateCategories(ctx, 1, undefined, lang);
  },
  async paginateCategories(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "categories:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], skip: (page - 1) * 8, take: 8, include: { _count: { select: { products: true } } } }),
      db.category.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 8) || 1;
    const text = `<b>🗂️ Categories</b> (${total})\n\n` + items.map((c) => `• ${c.name}: ${c._count.products} products${c.status === "ACTIVE" ? "" : " (inactive)"}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}\n\nAdd one: <code>/addcategory Name</code>`;
    await this.sendOrEdit(ctx, text, { inline_keyboard: [this.paginationRow(page, totalPages, "categories_page")] }, messageId);
  },
  // /addcategory Name | description(optional)
  async cmdAddCategory(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "categories:create")) return this.deny(ctx, lang);
    const usage = "Usage:\n<code>/addcategory Name | description(optional)</code>";
    if (!raw) return TelegramService.sendMessage(ctx.chatId, usage);
    const [name, description] = raw.split("|").map((p) => p.trim());
    if (!name || name.length < 2) return TelegramService.sendMessage(ctx.chatId, "❌ Name must be at least 2 characters.");
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const existing = await db.category.findUnique({ where: { slug } });
    if (existing) return TelegramService.sendMessage(ctx.chatId, "❌ A category with this name already exists.");
    const c = await db.category.create({ data: { name, slug, description: description || undefined } });
    await AuditService.log({ userId: ctx.user?.id ?? null, action: "CATEGORY_CREATE", entity: "Category", entityId: c.id, changes: { name, via: "telegram" } });
    await TelegramService.sendMessage(ctx.chatId, `✅ Category created: <b>${c.name}</b>`);
  },

  // --- Expenses: list, add ---
  async cmdExpenses(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "expenses:read")) return this.deny(ctx, lang);
    await this.paginateExpenses(ctx, 1, undefined, lang);
  },
  async paginateExpenses(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "expenses:read")) return this.deny(ctx, lang);
    const [items, total, agg] = await Promise.all([
      db.expense.findMany({ orderBy: { expenseDate: "desc" }, skip: (page - 1) * 5, take: 5, include: { category: { select: { name: true } } } }),
      db.expense.count(),
      db.expense.aggregate({ _sum: { amount: true } }),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>💸 Expenses</b> (${total} · total ${money((agg._sum.amount ?? 0).toFixed(2))})\n\n` + items.map((e) => `• ${e.category.name}: ${money(e.amount)} — ${e.description ?? e.paymentMethod}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}\n\nAdd one: <code>/addexpense Category | Amount | Method | Note(optional)</code>`;
    await this.sendOrEdit(ctx, text, { inline_keyboard: [this.paginationRow(page, totalPages, "expenses_page")] }, messageId);
  },
  // /addexpense Category | Amount | Method | Note(optional)
  async cmdAddExpense(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "expenses:create")) return this.deny(ctx, lang);
    const usage = "Usage:\n<code>/addexpense Category | Amount | Method | Note(optional)</code>\n\nMethods: CASH, BKASH, NAGAD, BANK, CARD, OTHER";
    if (!raw) return TelegramService.sendMessage(ctx.chatId, usage);
    const [categoryName, amountStr, methodRaw, note] = raw.split("|").map((p) => p.trim());
    const amount = Number(amountStr);
    const method = methodRaw?.toUpperCase();
    if (!categoryName || !Number.isFinite(amount) || amount <= 0 || !method) return TelegramService.sendMessage(ctx.chatId, usage);
    let category = await db.expenseCategory.findUnique({ where: { name: categoryName } });
    if (!category) category = await db.expenseCategory.create({ data: { name: categoryName } });
    const e = await db.expense.create({ data: { categoryId: category.id, amount, paymentMethod: method, description: note || undefined, createdBy: ctx.user?.id } });
    await AuditService.log({ userId: ctx.user?.id ?? null, action: "EXPENSE_CREATE", entity: "Expense", entityId: e.id, changes: { amount, category: category.name, via: "telegram" } });
    await TelegramService.sendMessage(ctx.chatId, `✅ Expense recorded: <b>${money(amount)}</b> — ${category.name}`);
  },

  // --- Products: list, view, add ---
  async cmdProducts(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "products:read")) return this.deny(ctx, lang);
    await this.paginateProducts(ctx, 1, undefined, lang);
  },
  async paginateProducts(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "products:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.product.findMany({ orderBy: { name: "asc" }, skip: (page - 1) * 5, take: 5, include: { inventory: { select: { quantity: true } } } }),
      db.product.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>📦 Products</b> (${total})\n\n` + items.map((p) => `• ${p.name} (${p.sku}): ${money(p.sellingPrice)}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((p) => [{ text: `📦 ${p.name}`, callback_data: `product_view:${p.id}` }]);
    rows.push(this.paginationRow(page, totalPages, "products_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async viewProduct(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "products:read")) return this.deny(ctx, lang);
    const p = await db.product.findUnique({ where: { id }, include: { category: { select: { name: true } }, inventory: { select: { quantity: true } } } });
    if (!p) return TelegramService.sendMessage(ctx.chatId, "Product not found");
    const text = `<b>📦 ${p.name}</b>\nSKU: ${p.sku}\nCategory: ${p.category?.name ?? "—"}\nSelling: ${money(p.sellingPrice)} · Purchase: ${money(p.purchasePrice)}\nStock: ${p.inventory?.quantity ?? 0}\nStatus: ${p.status}`;
    await this.sendOrEdit(ctx, text, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "products_page:1" }]] }, messageId);
  },
  // /addproduct Name | SKU | SellingPrice | PurchasePrice(optional) | Category(optional)
  async cmdAddProduct(ctx: CommandContext, raw: string, lang: string) {
    if (!this.can(ctx, "products:create")) return this.deny(ctx, lang);
    const usage = "Usage:\n<code>/addproduct Name | SKU | SellingPrice | PurchasePrice(optional) | Category(optional)</code>";
    if (!raw) return TelegramService.sendMessage(ctx.chatId, usage);
    const [name, sku, sellingStr, purchaseStr, categoryName] = raw.split("|").map((p) => p.trim());
    const sellingPrice = Number(sellingStr);
    if (!name || !sku || !Number.isFinite(sellingPrice)) return TelegramService.sendMessage(ctx.chatId, usage);
    const existing = await db.product.findUnique({ where: { sku } });
    if (existing) return TelegramService.sendMessage(ctx.chatId, "❌ A product with this SKU already exists.");
    let categoryId: string | undefined;
    if (categoryName) {
      const cat = await db.category.findFirst({ where: { name: categoryName } });
      categoryId = cat?.id;
    }
    const slug = sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const p = await db.product.create({ data: { name, sku, slug, sellingPrice, purchasePrice: Number(purchaseStr) || 0, categoryId, inventory: { create: { quantity: 0 } } } });
    await AuditService.log({ userId: ctx.user?.id ?? null, action: "PRODUCT_CREATE", entity: "Product", entityId: p.id, changes: { name, sku, via: "telegram" } });
    await TelegramService.sendMessage(ctx.chatId, `✅ Product created: <b>${p.name}</b> (${p.sku})\nUse /inventory to add stock via a stock adjustment.`);
  },

  // --- Stock Movements: read-only ledger ---
  async cmdStockMovements(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "inventory:read")) return this.deny(ctx, lang);
    await this.paginateStockMovements(ctx, 1, undefined, lang);
  },
  async paginateStockMovements(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "inventory:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.stockMovement.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 8, take: 8, include: { product: { select: { name: true } } } }),
      db.stockMovement.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 8) || 1;
    const text = `<b>🔄 Stock Movements</b> (${total})\n\n` + items.map((m) => `• ${m.product.name}: ${m.type} ${Number(m.quantityChange) > 0 ? "+" : ""}${m.quantityChange}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    await this.sendOrEdit(ctx, text, { inline_keyboard: [this.paginationRow(page, totalPages, "movements_page")] }, messageId);
  },

  // --- Inbox: list conversations ---
  async cmdInbox(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "conversations:read")) return this.deny(ctx, lang);
    await this.paginateInbox(ctx, 1, undefined, lang);
  },
  async paginateInbox(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "conversations:read")) return this.deny(ctx, lang);
    const { items, total } = await ConversationService.list({ page, limit: 5, status: "OPEN" });
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>📥 Inbox — Open</b> (${total})\n\n` + items.map((c: any) => `• ${c.contactName ?? c.customer?.name ?? "Unknown"} (${c.provider})${c.unreadCount ? ` · ${c.unreadCount} unread` : ""}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((c: any) => [{ text: `💬 ${c.contactName ?? c.customer?.name ?? "Unknown"}`, callback_data: `conversation_view:${c.id}` }]);
    rows.push(this.paginationRow(page, totalPages, "inbox_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async viewConversation(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "conversations:read")) return this.deny(ctx, lang);
    const c: any = await ConversationService.get(id);
    if (!c) return TelegramService.sendMessage(ctx.chatId, "Conversation not found");
    const text = `<b>💬 ${c.contactName ?? c.customer?.name ?? "Unknown"}</b>\nChannel: ${c.provider}\nStatus: ${c.status}\nLast message: ${c.lastMessagePreview ?? "—"}`;
    await this.sendOrEdit(ctx, text, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "inbox_page:1" }]] }, messageId);
  },

  // --- Notifications: list, mark all read ---
  async cmdNotifications(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "notifications:read")) return this.deny(ctx, lang);
    await this.paginateNotifications(ctx, 1, undefined, lang);
  },
  async paginateNotifications(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "notifications:read")) return this.deny(ctx, lang);
    const { items, total } = await NotificationService.listForUser(ctx.user?.id, { page, limit: 8, unreadOnly: true });
    const rows: any[][] = [];
    if (items.length) rows.push([{ text: "✅ Mark all as read", callback_data: "notif_mark_all" }]);
    if (!items.length) {
      await this.sendOrEdit(ctx, `<b>🔔 Notifications</b>\n\nNo unread notifications.`, { inline_keyboard: rows }, messageId);
      return;
    }
    const totalPages = Math.ceil(total / 8) || 1;
    const text = `<b>🔔 Notifications</b> (${total} unread)\n\n` + items.map((n: any) => `• ${n.title}: ${n.message}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    rows.push(this.paginationRow(page, totalPages, "notifications_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async confirmMarkAllNotificationsPrompt(ctx: CommandContext, messageId: number | undefined, lang: string) {
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: "notif_mark_all_confirm" },
      { text: this.t("no", lang), callback_data: "notifications_page:1" },
    ]] };
    await this.sendOrEdit(ctx, `${this.t("confirm", lang)} Mark all your notifications as read?`, kb, messageId);
  },
  async confirmMarkAllNotifications(ctx: CommandContext, messageId: number | undefined, lang: string) {
    await NotificationService.markAllRead(ctx.user?.id);
    await this.sendOrEdit(ctx, `${this.t("done", lang)} All notifications marked as read.`, undefined, messageId);
  },

  // --- Sales Pipeline: list, view, move stage ---
  async cmdPipeline(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "pipelines:read")) return this.deny(ctx, lang);
    const p = await SalesPipelineService.pipeline();
    const text = `<b>📊 Sales Pipeline</b>\n` + Object.entries(p).map(([stage, s]) => `• ${stage}: ${(s as any).count} (${money((s as any).value)})`).join("\n");
    await TelegramService.sendMessage(ctx.chatId, text, { inline_keyboard: [[{ text: "📋 View entries", callback_data: "pipeline_page:1" }]] });
  },
  async paginatePipeline(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "pipelines:read")) return this.deny(ctx, lang);
    const { items, total } = await SalesPipelineService.list({ page, limit: 5 });
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 5) || 1;
    const text = `<b>📊 Pipeline Entries</b> (${total})\n\n` + items.map((e: any) => `• ${e.customer?.name ?? "—"}: ${e.stage} (${money(e.value)})`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((e: any) => [{ text: `📊 ${e.customer?.name ?? "—"} (${e.stage})`, callback_data: `pipeline_view:${e.id}` }]);
    rows.push(this.paginationRow(page, totalPages, "pipeline_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async viewPipelineEntry(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "pipelines:read")) return this.deny(ctx, lang);
    const e = await db.salesPipelineEntry.findUnique({ where: { id }, include: { customer: { select: { name: true } } } });
    if (!e) return TelegramService.sendMessage(ctx.chatId, "Entry not found");
    const text = `<b>📊 ${e.customer.name}</b>\nStage: <b>${e.stage}</b>\nValue: ${money(e.value)}\nNotes: ${e.notes ?? "—"}`;
    const rows: any[][] = [];
    if (this.can(ctx, "pipelines:update")) rows.push([{ text: "🔀 Move Stage", callback_data: `pipeline_stage_menu:${e.id}` }]);
    rows.push([{ text: "⬅️ Back", callback_data: "pipeline_page:1" }]);
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async pipelineStageMenu(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "pipelines:update")) return this.deny(ctx, lang);
    const stages = ["NEW", "CONTACTED", "QUALIFIED", "NEGOTIATION", "ORDER_CREATED", "WON", "LOST"];
    const rows: any[][] = stages.map((s) => [{ text: s, callback_data: `pipeline_stage_set:${id}|${s}` }]);
    rows.push([{ text: "⬅️ Back", callback_data: `pipeline_view:${id}` }]);
    await this.sendOrEdit(ctx, "Select new stage:", { inline_keyboard: rows }, messageId);
  },
  async confirmPipelineStagePrompt(ctx: CommandContext, id: string, stage: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "pipelines:update")) return this.deny(ctx, lang);
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: `pipeline_stage_confirm:${id}|${stage}` },
      { text: this.t("no", lang), callback_data: `pipeline_view:${id}` },
    ]] };
    await this.sendOrEdit(ctx, `${this.t("confirm", lang)} Move to stage <b>${stage}</b>?`, kb, messageId);
  },
  async confirmPipelineStage(ctx: CommandContext, id: string, stage: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "pipelines:update")) return this.deny(ctx, lang);
    try {
      await SalesPipelineService.updateStage(id, stage);
      await this.sendOrEdit(ctx, `${this.t("done", lang)} Stage set to <b>${stage}</b>.`, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: `pipeline_view:${id}` }]] }, messageId);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  // --- Couriers: list, toggle active ---
  async cmdCouriers(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "deliveries:read")) return this.deny(ctx, lang);
    await this.paginateCouriers(ctx, 1, undefined, lang);
  },
  async paginateCouriers(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "deliveries:read")) return this.deny(ctx, lang);
    const all = await CourierService.listProviders();
    const total = all.length;
    const items = all.slice((page - 1) * 8, page * 8);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 8) || 1;
    const text = `<b>🚴 Couriers</b> (${total})\n\n` + items.map((c: any) => `• ${c.name}${c.isActive ? " 🟢" : " ⚪"}${c.isMock ? " (mock)" : ""}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = [];
    if (this.can(ctx, "deliveries:update")) rows.push(...items.map((c: any) => [{ text: `${c.isActive ? "⛔ Deactivate" : "✅ Activate"} ${c.name}`, callback_data: `courier_toggle:${c.id}` }]));
    rows.push(this.paginationRow(page, totalPages, "couriers_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async confirmCourierTogglePrompt(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "deliveries:update")) return this.deny(ctx, lang);
    const c = await db.courierProvider.findUnique({ where: { id } });
    if (!c) return;
    const next = c.isActive ? "inactive" : "active";
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: `courier_toggle_confirm:${id}|${next}` },
      { text: this.t("no", lang), callback_data: "couriers_page:1" },
    ]] };
    await this.sendOrEdit(ctx, `${this.t("confirm", lang)} ${c.isActive ? "Deactivate" : "Activate"} <b>${c.name}</b>?`, kb, messageId);
  },
  async confirmCourierToggle(ctx: CommandContext, id: string, next: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "deliveries:update")) return this.deny(ctx, lang);
    try {
      const c = await CourierService.updateProvider(id, { isActive: next === "active" });
      await this.sendOrEdit(ctx, `${this.t("done", lang)} <b>${c.name}</b> is now ${c.isActive ? "🟢 active" : "⚪ inactive"}.`, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "couriers_page:1" }]] }, messageId);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  // --- Automation: list rules, toggle active ---
  async cmdAutomation(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "automation:read")) return this.deny(ctx, lang);
    await this.paginateAutomation(ctx, 1, undefined, lang);
  },
  async paginateAutomation(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "automation:read")) return this.deny(ctx, lang);
    const all = await AutomationService.listRules();
    const total = all.length;
    const items = all.slice((page - 1) * 8, page * 8);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 8) || 1;
    const text = `<b>⚙️ Automation Rules</b> (${total})\n\n` + items.map((r: any) => `• ${r.name}: ${r.event} → ${r.action}${r.isActive ? " 🟢" : " ⚪"}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = [];
    if (this.can(ctx, "automation:update")) rows.push(...items.map((r: any) => [{ text: `${r.isActive ? "⛔ Disable" : "✅ Enable"} ${r.name}`, callback_data: `automation_toggle:${r.id}` }]));
    rows.push(this.paginationRow(page, totalPages, "automation_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async confirmAutomationTogglePrompt(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "automation:update")) return this.deny(ctx, lang);
    const r = await db.automationRule.findUnique({ where: { id } });
    if (!r) return;
    const next = r.isActive ? "inactive" : "active";
    const kb = { inline_keyboard: [[
      { text: this.t("yes", lang), callback_data: `automation_toggle_confirm:${id}|${next}` },
      { text: this.t("no", lang), callback_data: "automation_page:1" },
    ]] };
    await this.sendOrEdit(ctx, `${this.t("confirm", lang)} ${r.isActive ? "Disable" : "Enable"} rule <b>${r.name}</b>?`, kb, messageId);
  },
  async confirmAutomationToggle(ctx: CommandContext, id: string, next: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "automation:update")) return this.deny(ctx, lang);
    try {
      const r = await AutomationService.updateRule(id, { isActive: next === "active" });
      await this.sendOrEdit(ctx, `${this.t("done", lang)} <b>${r.name}</b> is now ${r.isActive ? "🟢 enabled" : "⚪ disabled"}.`, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "automation_page:1" }]] }, messageId);
    } catch (e) {
      await TelegramService.sendMessage(ctx.chatId, `❌ ${(e as Error).message}`);
    }
  },

  // --- Message Templates: list, view ---
  async cmdTemplates(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "message_templates:read")) return this.deny(ctx, lang);
    await this.paginateTemplates(ctx, 1, undefined, lang);
  },
  async paginateTemplates(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "message_templates:read")) return this.deny(ctx, lang);
    const all = await MessageTemplateService.list({});
    const total = all.length;
    const items = all.slice((page - 1) * 8, page * 8);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 8) || 1;
    const text = `<b>📨 Message Templates</b> (${total})\n\n` + items.map((t: any) => `• ${t.name} (${t.channel})${t.isApproved ? " ✅" : ""}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    const rows: any[][] = items.map((t: any) => [{ text: `📨 ${t.name}`, callback_data: `template_view:${t.id}` }]);
    rows.push(this.paginationRow(page, totalPages, "templates_page"));
    await this.sendOrEdit(ctx, text, { inline_keyboard: rows }, messageId);
  },
  async viewTemplate(ctx: CommandContext, id: string, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "message_templates:read")) return this.deny(ctx, lang);
    const t = await db.messageTemplate.findUnique({ where: { id } });
    if (!t) return TelegramService.sendMessage(ctx.chatId, "Template not found");
    const text = `<b>📨 ${t.name}</b>\nChannel: ${t.channel} · Category: ${t.category}\nApproved: ${t.isApproved ? "✅" : "❌"}\n\n${t.body}`;
    await this.sendOrEdit(ctx, text, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "templates_page:1" }]] }, messageId);
  },

  // --- Billing & Wallet: read-only summary ---
  async cmdWallet(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "billing:read")) return this.deny(ctx, lang);
    if (!ctx.user?.id) return TelegramService.sendMessage(ctx.chatId, "Link your account first with /link in a private chat.");
    const [wallet, sub] = await Promise.all([
      BillingService.getWalletBalance(ctx.user.id),
      BillingService.getCurrentSubscription(ctx.user.id),
    ]);
    const text = `<b>💳 Billing & Wallet</b>\n\nWallet balance: ${money(wallet.balance)}\nDeposited: ${money(wallet.totalDeposited)} · Spent: ${money(wallet.totalSpent)}\n\nSubscription: ${sub ? `${sub.plan} (${sub.status})` : "None"}`;
    await TelegramService.sendMessage(ctx.chatId, text);
  },

  // --- Audit Logs: read-only recent activity ---
  async cmdAuditLogs(ctx: CommandContext, _args: string[], lang: string) {
    if (!this.can(ctx, "audit_logs:read")) return this.deny(ctx, lang);
    await this.paginateAuditLogs(ctx, 1, undefined, lang);
  },
  async paginateAuditLogs(ctx: CommandContext, page: number, messageId: number | undefined, lang: string) {
    if (!this.can(ctx, "audit_logs:read")) return this.deny(ctx, lang);
    const [items, total] = await Promise.all([
      db.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 8, take: 8, include: { user: { select: { name: true } } } }),
      db.auditLog.count(),
    ]);
    if (!items.length) return TelegramService.sendMessage(ctx.chatId, this.t("noData", lang));
    const totalPages = Math.ceil(total / 8) || 1;
    const text = `<b>🕵️ Audit Logs</b> (${total})\n\n` + items.map((l) => `• ${l.action} — ${l.entity} · ${l.user?.name ?? "system"} · ${new Date(l.createdAt).toLocaleString()}`).join("\n") + `\n\n${this.t("page", lang).replace("{p}", String(page)).replace("{t}", String(totalPages))}`;
    await this.sendOrEdit(ctx, text, { inline_keyboard: [this.paginationRow(page, totalPages, "auditlogs_page")] }, messageId);
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
