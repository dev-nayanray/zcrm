import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// MessageTemplateService — WhatsApp / Messenger / Email templates with
// {{variable}} interpolation. Templates must be validated before sending;
// WhatsApp templates must additionally be approved (isApproved=true) to send.

const VARIABLE_RE = /\{\{\s*([\w_]+)\s*\}\}/g;

export const MessageTemplateService = {
  extractVariables(body: string): string[] {
    const set = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = VARIABLE_RE.exec(body)) !== null) set.add(m[1]);
    return Array.from(set);
  },

  render(body: string, vars: Record<string, string>): string {
    return body.replace(VARIABLE_RE, (_, name: string) => vars[name] ?? "");
  },

  // Validate that every variable referenced in the body can be resolved.
  validate(body: string, vars: Record<string, string>): { ok: boolean; missing: string[] } {
    const required = this.extractVariables(body);
    const missing = required.filter((v) => vars[v] === undefined || vars[v] === "");
    return { ok: missing.length === 0, missing };
  },

  async list(opts: { channel?: string; status?: string }) {
    const where: Prisma.MessageTemplateWhereInput = {};
    if (opts.channel) where.channel = opts.channel;
    if (opts.status) where.status = opts.status;
    return db.messageTemplate.findMany({ where, orderBy: { createdAt: "desc" } });
  },

  async create(data: { name: string; channel: string; category?: string; language?: string; subject?: string; body: string; isApproved?: boolean; externalId?: string }) {
    const variables = this.extractVariables(data.body);
    return db.messageTemplate.create({
      data: { ...data, variables: JSON.stringify(variables), status: "ACTIVE" },
    });
  },

  async update(id: string, data: Partial<{ name: string; channel: string; category: string; language: string; subject: string; body: string; isApproved: boolean; status: string }>) {
    if (data.body !== undefined) {
      const variables = this.extractVariables(data.body);
      (data as { variables?: string }).variables = JSON.stringify(variables);
    }
    return db.messageTemplate.update({ where: { id }, data });
  },

  async del(id: string) {
    return db.messageTemplate.delete({ where: { id } });
  },

  // Standard order/customer variables used by transactional templates.
  orderVariables(order: {
    orderNumber: string; total: string | { toFixed: (n: number) => string }; customer?: { name: string } | null; customerName?: string;
  }, businessName: string): Record<string, string> {
    const total = typeof order.total === "string" ? order.total : order.total.toFixed(2);
    return {
      customer_name: order.customer?.name ?? order.customerName ?? "Customer",
      order_number: order.orderNumber,
      order_total: total,
      payment_status: "",
      tracking_number: "",
      business_name: businessName,
    };
  },
};
