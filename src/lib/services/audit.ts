import { db } from "@/lib/db";
import { PrismaClient, Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

type TxClient = Prisma.TransactionClient | PrismaClient;

// Actions that should NOT be broadcast to Telegram as a generic "CRM
// updated" notification — auth/session noise and anything that could leak
// sensitive config (bot tokens, secrets).
const BROADCAST_EXCLUDED_ACTIONS = new Set([
  "LOGIN", "LOGOUT", "LOGIN_2FA_CHALLENGE",
  "2FA_ENABLED", "2FA_DISABLED",
  "TELEGRAM_CONFIG",
]);

function humanizeAction(action: string): string {
  return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Best-effort broadcast of a generic CRM change to any Telegram group
// subscribed to the "CRM_UPDATE" event. Fire-and-forget: never throws, and
// is only invoked AFTER the audit row is durably written outside of any
// in-flight transaction (see log() below) so we never notify about a
// change that could still be rolled back.
async function broadcastCrmUpdate(opts: { userId?: string | null; action: string; entity: string; entityId?: string | null }) {
  if (BROADCAST_EXCLUDED_ACTIONS.has(opts.action)) return;
  try {
    const { TelegramService } = await import("./telegram");
    let who = "";
    if (opts.userId) {
      const user = await db.user.findUnique({ where: { id: opts.userId }, select: { name: true } }).catch(() => null);
      if (user) who = ` by ${user.name}`;
    }
    const message = `🔄 <b>CRM Update</b>\n${humanizeAction(opts.action)} — ${opts.entity}${opts.entityId ? ` (${opts.entityId})` : ""}${who}`;
    await TelegramService.routeNotification("CRM_UPDATE", message);
  } catch (e) {
    console.error("[AuditService] broadcastCrmUpdate failed:", e);
  }
}

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
      // Only broadcast outside a transaction: inside one, the write could
      // still be rolled back by the caller, and callers already send their
      // own precise Telegram notifications (order, payment, inventory,
      // lead) for transactional flows — see routeNotification() call sites.
      if (!tx) {
        void broadcastCrmUpdate(opts);
      }
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
