import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { AuditService } from "./audit";
import { NotificationService } from "./notification";

// LeadService — Meta lead pipeline management.
// Pipeline stages: NEW|CONTACTED|QUALIFIED|NEGOTIATION|ORDER_CREATED|WON|LOST
// Lead statuses (MetaLead.status): NEW|CONTACTED|QUALIFIED|FOLLOW_UP|CONVERTED|LOST
// LeadFollowUp stores assignment + pipeline stage + follow-up date.
export const LeadService = {
  async list(opts: { page: number; limit: number; status?: string; stage?: string; assignedToId?: string; search?: string }) {
    const where: Prisma.MetaLeadWhereInput = {};
    if (opts.status) where.status = opts.status;
    if (opts.search) {
      where.OR = [{ name: { contains: opts.search } }, { phone: { contains: opts.search } }, { email: { contains: opts.search } }, { campaign: { contains: opts.search } }];
    }
    if (opts.assignedToId || opts.stage) {
      where.followUp = {};
      if (opts.assignedToId) where.followUp.assignedToId = opts.assignedToId;
      if (opts.stage) where.followUp.pipelineStage = opts.stage;
    }
    const [items, total] = await Promise.all([
      db.metaLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          connection: { select: { name: true, facebookPageName: true } },
          followUp: { include: { assignedTo: { select: { id: true, name: true } } } },
        },
      }),
      db.metaLead.count({ where }),
    ]);
    return { items, total };
  },

  async get(id: string) {
    return db.metaLead.findUnique({
      where: { id },
      include: { customer: true, connection: { select: { name: true } }, followUp: { include: { assignedTo: { select: { id: true, name: true } } } } },
    });
  },

  // Assign a lead to a sales user + set pipeline stage + follow-up date.
  async assign(leadId: string, opts: { assignedToId?: string; pipelineStage?: string; followUpDate?: Date; notes?: string }) {
    const user = await getCurrentUser();
    const data: Prisma.LeadFollowUpUpdateInput | Prisma.LeadFollowUpUncheckedCreateInput = {
      assignedToId: opts.assignedToId,
      pipelineStage: opts.pipelineStage,
      followUpDate: opts.followUpDate,
      notes: opts.notes,
    };
    const existing = await db.leadFollowUp.findUnique({ where: { leadId } });
    let followUp;
    if (existing) {
      followUp = await db.leadFollowUp.update({ where: { leadId }, data });
    } else {
      followUp = await db.leadFollowUp.create({ data: { leadId, ...opts } as any });
    }
    // also update the lead status to match the pipeline stage when provided
    if (opts.pipelineStage) {
      const statusMap: Record<string, string> = { NEW: "NEW", CONTACTED: "CONTACTED", QUALIFIED: "QUALIFIED", NEGOTIATION: "FOLLOW_UP", ORDER_CREATED: "FOLLOW_UP", WON: "CONVERTED", LOST: "LOST" };
      await db.metaLead.update({ where: { id: leadId }, data: { status: statusMap[opts.pipelineStage] ?? "CONTACTED" } });
    }
    await AuditService.log({ userId: user?.id, action: "LEAD_ASSIGN", entity: "MetaLead", entityId: leadId, changes: opts });
    return followUp;
  },

  // Convert a lead into a customer (idempotent — reuses existing customer by phone).
  async convertToCustomer(leadId: string) {
    const lead = await db.metaLead.findUnique({ where: { id: leadId } });
    if (!lead) throw new Error("Lead not found");
    if (lead.customerId) return lead.customerId;
    if (!lead.phone) throw new Error("Lead has no phone number");
    const existing = await db.customer.findUnique({ where: { phone: lead.phone } });
    let customerId: string;
    if (existing) customerId = existing.id;
    else {
      const c = await db.customer.create({ data: { name: lead.name, phone: lead.phone, email: lead.email ?? undefined, notes: `Converted from Meta Lead ${lead.externalLeadId}` } });
      customerId = c.id;
    }
    await db.metaLead.update({ where: { id: leadId }, data: { customerId, status: "CONVERTED" } });
    await db.leadFollowUp.upsert({ where: { leadId }, create: { leadId, pipelineStage: "ORDER_CREATED", convertedCustomerId: customerId }, update: { pipelineStage: "ORDER_CREATED", convertedCustomerId: customerId } });
    await AuditService.logFromRequest({ action: "LEAD_CONVERT", entity: "MetaLead", entityId: leadId, changes: { customerId } });
    await NotificationService.create({ type: "LEAD_CONVERTED", title: "Lead converted", message: `${lead.name} is now a customer`, link: `/customers/detail?id=${customerId}` });
    return customerId;
  },

  // Pipeline summary for the Lead Pipeline UI.
  async pipeline() {
    const stages = ["NEW", "CONTACTED", "QUALIFIED", "NEGOTIATION", "ORDER_CREATED", "WON", "LOST"];
    const result: Record<string, { count: number; value: string }> = {};
    for (const stage of stages) {
      const count = await db.metaLead.count({ where: { followUp: { pipelineStage: stage } } });
      result[stage] = { count, value: "0.00" };
    }
    // leads without a followUp default to NEW
    const unassigned = await db.metaLead.count({ where: { followUp: null, status: "NEW" } });
    result.NEW.count += unassigned;
    return result;
  },
};
