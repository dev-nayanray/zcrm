import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";
import { getCurrentUser } from "@/lib/auth";
import { AuditService } from "./audit";

// SalesPipelineService — lightweight sales pipeline that reuses Customer +
// Conversation + Order (no separate CRM architecture).
// Stages: NEW|CONTACTED|QUALIFIED|NEGOTIATION|ORDER_CREATED|WON|LOST
export const SalesPipelineService = {
  async list(opts: { page: number; limit: number; stage?: string; assignedToId?: string; search?: string }) {
    const where: Prisma.SalesPipelineEntryWhereInput = {};
    if (opts.stage) where.stage = opts.stage;
    if (opts.assignedToId) where.assignedToId = opts.assignedToId;
    if (opts.search) {
      where.OR = [{ customer: { name: { contains: opts.search } } }, { customer: { phone: { contains: opts.search } } }, { notes: { contains: opts.search } }];
    }
    const [items, total] = await Promise.all([
      db.salesPipelineEntry.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        include: { customer: { select: { id: true, name: true, phone: true } }, assignedTo: { select: { id: true, name: true } } },
      }),
      db.salesPipelineEntry.count({ where }),
    ]);
    return { items: items.map((e) => ({ ...e, value: e.value.toFixed(2) })), total };
  },

  async create(data: { customerId: string; conversationId?: string; value?: number | string; stage?: string; expectedCloseDate?: Date; assignedToId?: string; notes?: string }) {
    const user = await getCurrentUser();
    const entry = await db.salesPipelineEntry.create({
      data: {
        customerId: data.customerId,
        conversationId: data.conversationId,
        value: toDecimal(data.value ?? 0),
        stage: data.stage ?? "NEW",
        expectedCloseDate: data.expectedCloseDate,
        assignedToId: data.assignedToId,
        notes: data.notes,
      },
    });
    await AuditService.log({ userId: user?.id, action: "PIPELINE_CREATE", entity: "SalesPipelineEntry", entityId: entry.id, changes: data });
    return entry;
  },

  async updateStage(id: string, stage: string, notes?: string) {
    const user = await getCurrentUser();
    const entry = await db.salesPipelineEntry.update({ where: { id }, data: { stage, notes: notes ?? undefined } });
    await AuditService.log({ userId: user?.id, action: "PIPELINE_UPDATE", entity: "SalesPipelineEntry", entityId: id, changes: { stage, notes } });
    return entry;
  },

  async del(id: string) {
    return db.salesPipelineEntry.delete({ where: { id } });
  },

  async pipeline() {
    const stages = ["NEW", "CONTACTED", "QUALIFIED", "NEGOTIATION", "ORDER_CREATED", "WON", "LOST"];
    const result: Record<string, { count: number; value: string }> = {};
    for (const stage of stages) {
      const rows = await db.salesPipelineEntry.findMany({ where: { stage }, select: { value: true } });
      const total = rows.reduce((s, r) => s.add(r.value), new Prisma.Decimal(0));
      result[stage] = { count: rows.length, value: total.toFixed(2) };
    }
    return result;
  },
};
