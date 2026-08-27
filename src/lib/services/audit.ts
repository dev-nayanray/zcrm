import { db } from "@/lib/db";
import { PrismaClient, Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

type TxClient = Prisma.TransactionClient | PrismaClient;

// Audit logging service. All logs are immutable (no update/delete API exposed).
// When called from inside a service transaction, pass the `tx` client so the
// audit write happens in the SAME transaction — this avoids SQLite write-lock
// deadlocks that would occur if we opened a separate transaction mid-flight.
export const AuditService = {
  async log(
    opts: {
      userId?: string | null;
      action: string;
      entity: string;
      entityId?: string | null;
      changes?: unknown;
      ipAddress?: string | null;
    },
    tx?: TxClient,
  ) {
    const client = tx ?? db;
    try {
      await client.auditLog.create({
        data: {
          userId: opts.userId ?? null,
          action: opts.action,
          entity: opts.entity,
          entityId: opts.entityId ?? null,
          changes: opts.changes ? JSON.stringify(opts.changes) : null,
          ipAddress: opts.ipAddress ?? null,
        },
      });
    } catch (e) {
      // Audit logging must never break the main operation when called
      // outside a transaction. (Inside a transaction, a failure will roll
      // the whole thing back — which is the safe, consistent choice.)
      if (!tx) {
        console.error("[AuditService] failed to log:", e);
      } else {
        throw e; // propagate inside transaction so it rolls back cleanly
      }
    }
  },

  // Convenience: log using the current session user (standalone transaction).
  async logFromRequest(opts: {
    action: string;
    entity: string;
    entityId?: string | null;
    changes?: unknown;
  }) {
    const user = await getCurrentUser();
    return AuditService.log({
      userId: user?.id,
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId,
      changes: opts.changes,
      ipAddress: null,
    });
  },

  async list(opts: { page: number; limit: number; search?: string; entity?: string; action?: string; userId?: string }) {
    const { page, limit, search, entity, action, userId } = opts;
    const where: Record<string, unknown> = { AND: [] };
    const and: Record<string, unknown>[] = [];
    if (search) {
      and.push({
        OR: [
          { action: { contains: search } },
          { entity: { contains: search } },
          { entityId: { contains: search } },
        ],
      });
    }
    if (entity) and.push({ entity });
    if (action) and.push({ action });
    if (userId) and.push({ userId });
    where.AND = and;
    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      db.auditLog.count({ where }),
    ]);
    return { items, total };
  },
};

// keep Prisma import referenced for type inference in some bundlers
void Prisma;
