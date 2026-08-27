import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { NotificationService } from "./notification";

// AutomationService — a simple event-based automation engine.
//
//   EVENT (ORDER_CREATED, PAYMENT_RECEIVED, STOCK_LOW, LEAD_CREATED,
//          ORDER_DELIVERED, ORDER_SHIPPED, ORDER_CANCELLED, DUE_PAYMENT)
//        → AutomationRule (where event matches AND isActive)
//        → ACTION (SEND_WHATSAPP_TEMPLATE | CREATE_NOTIFICATION |
//                  ASSIGN_SALES_USER | CONVERT_RESERVATION)
//        → AutomationExecution (status PENDING/SUCCESS/FAILED/SKIPPED)
//
// CRITICAL: automation NEVER blocks the main business transaction. The trigger()
// method is fire-and-forget (async, catches all errors). Rules are evaluated
// AFTER the committing transaction completes.
export const AutomationService = {
  // Fire an event. Looks up matching active rules and executes each in the
  // background. Never throws.
  async trigger(event: string, ctx: { entityId?: string; variables?: Record<string, string>; payload?: unknown }) {
    try {
      const rules = await db.automationRule.findMany({ where: { event, isActive: true } });
      for (const rule of rules) {
        // fire-and-forget execution (do not await between rules)
        void this.executeRule(rule, ctx);
      }
    } catch (e) {
      console.error(`[Automation] trigger ${event} failed:`, e);
    }
  },

  async executeRule(rule: { id: string; event: string; action: string; templateName?: string | null; targetRole?: string | null; config?: string | null }, ctx: { entityId?: string; variables?: Record<string, string>; payload?: unknown }) {
    const exec = await db.automationExecution.create({
      data: { ruleId: rule.id, event: rule.event, entityId: ctx.entityId ?? null, status: "PENDING" },
    });
    try {
      let result = "";
      switch (rule.action) {
        case "CREATE_NOTIFICATION": {
          const n = await NotificationService.create({
            type: rule.event,
            title: rule.event.replace(/_/g, " "),
            message: ctx.variables?.message ?? `Automation: ${rule.event}`,
            link: ctx.entityId ? `/orders/detail?id=${ctx.entityId}` : undefined,
          });
          result = `notification:${n.id}`;
          break;
        }
        case "ASSIGN_SALES_USER": {
          // assign to the first active user with the target role
          if (rule.targetRole) {
            const role = await db.role.findUnique({ where: { name: rule.targetRole } });
            if (role) {
              const user = await db.user.findFirst({ where: { roleId: role.id, isActive: true } });
              if (user) {
                // FIX: the previous implementation looked up a Conversation
                // by ctx.entityId — but for ORDER_CREATED events the
                // entityId is the ORDER id, not a conversation id, so the
                // lookup always failed. Now we look up the conversation via
                // the order's conversationId (if linked), then fall back
                // to no-op if no conversation is linked.
                let conv: { id: string } | null = null;
                if (ctx.entityId) {
                  // Try as conversation id first (some events pass conv id).
                  try {
                    conv = await db.conversation.findUnique({ where: { id: ctx.entityId } });
                  } catch {
                    conv = null;
                  }
                  if (!conv) {
                    // Try as order id — find the linked conversation.
                    try {
                      const order = await db.order.findUnique({ where: { id: ctx.entityId }, include: { conversation: true } });
                      if (order?.conversation) conv = order.conversation;
                    } catch {
                      // ignore — leave conv null
                    }
                  }
                }
                if (conv) {
                  await db.conversation.update({ where: { id: conv.id }, data: { assignedUserId: user.id } });
                  result = `assigned:${user.id}`;
                } else {
                  result = `no conversation to assign (user ${user.id} available)`;
                }
              }
            }
          }
          break;
        }
        case "SEND_WHATSAPP_TEMPLATE": {
          // Look up the template, render variables, and send via WhatsAppService
          // if a WhatsApp connection + phone is available.
          if (!rule.templateName) { result = "no template"; break; }
          const template = await db.messageTemplate.findUnique({ where: { name: rule.templateName } });
          if (!template || !template.isApproved) { result = "template not approved"; break; }
          const { MessageTemplateService } = await import("./message-template");
          const body = MessageTemplateService.render(template.body, ctx.variables ?? {});
          // find a whatsapp connection + the customer's conversation
          const conn = await db.whatsAppConnection.findFirst({ where: { status: "CONNECTED" } });
          if (!conn) { result = "no whatsapp connection"; break; }
          // entityId is the order id — find the linked conversation
          const order = await db.order.findUnique({ where: { id: ctx.entityId }, include: { conversation: true, customer: true } });
          const phone = order?.conversation?.contactPhone ?? order?.customer?.phone;
          if (!phone) { result = "no phone"; break; }
          try {
            const { WhatsAppService } = await import("./whatsapp");
            // upsert a conversation for this order if not linked
            let convId = order?.conversationId;
            if (!convId && order?.customer) {
              const conv = await db.conversation.create({
                data: { provider: "whatsapp", externalConversationId: phone, contactPhone: phone, contactName: order.customer.name, customerId: order.customer.id, providerConnectionId: conn.id, status: "OPEN", lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 120) },
              });
              convId = conv.id;
            }
            if (convId) {
              const res = await WhatsAppService.sendMessage({ connectionId: conn.id, conversationId: convId, to: phone, body });
              result = `sent:${res.messageId}`;
            } else {
              result = "no conversation";
            }
          } catch (e) {
            result = `send failed: ${(e as Error).message}`;
          }
          break;
        }
        case "CONVERT_RESERVATION": {
          // The OrderService.updateStatus already converts reservations on DELIVERED.
          // This action is a no-op marker for audit; the real conversion happens in
          // OrderService.updateStatus so it stays transactional.
          result = "handled by OrderService";
          break;
        }
        default:
          result = `unknown action: ${rule.action}`;
      }
      await db.automationExecution.update({ where: { id: exec.id }, data: { status: "SUCCESS", result } });
    } catch (e) {
      await db.automationExecution.update({ where: { id: exec.id }, data: { status: "FAILED", error: (e as Error).message } });
    }
  },

  async listRules() {
    return db.automationRule.findMany({ orderBy: { event: "asc" }, include: { _count: { select: { executions: true } } } });
  },

  async getRule(id: string) {
    return db.automationRule.findUnique({ where: { id }, include: { _count: { select: { executions: true } } } });
  },

  async createRule(data: { name: string; event: string; action: string; templateName?: string; targetRole?: string; config?: string }) {
    const existing = await db.automationRule.findUnique({ where: { name: data.name } });
    if (existing) throw new Error("Rule name already exists");
    return db.automationRule.create({ data: { ...data, isActive: true } });
  },

  async updateRule(id: string, data: Partial<{ name: string; event: string; action: string; templateName: string; targetRole: string; config: string; isActive: boolean }>) {
    return db.automationRule.update({ where: { id }, data });
  },

  async deleteRule(id: string) {
    return db.automationRule.delete({ where: { id } });
  },

  async listExecutions(opts: { page: number; limit: number; status?: string }) {
    const where: Prisma.AutomationExecutionWhereInput = {};
    if (opts.status) where.status = opts.status;
    const [items, total] = await Promise.all([
      db.automationExecution.findMany({ where, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.limit, take: opts.limit, include: { rule: { select: { name: true, action: true } } } }),
      db.automationExecution.count({ where }),
    ]);
    return { items, total };
  },
};
