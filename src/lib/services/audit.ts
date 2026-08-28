import { db } from "@/lib/db";
import { PrismaClient, Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

type TxClient = Prisma.TransactionClient | PrismaClient;

// Actions that should NEVER be broadcast to any Telegram group — only
// things that could leak sensitive config (bot tokens, webhook secrets).
// Auth/session events are NOT excluded anymore: they're routed to their
// own dedicated event types below instead of the generic CRM_UPDATE feed,
// so admins can subscribe a "Security" group to real login/logout/2FA
// activity without spamming the general updates channel with it.
const BROADCAST_EXCLUDED_ACTIONS = new Set([
  "TELEGRAM_CONFIG",
]);

// Auth/session actions get their own event type instead of "CRM_UPDATE".
const AUTH_EVENT_TYPES: Record<string, string> = {
  LOGIN: "LOGIN_ALERT",
  LOGOUT: "LOGOUT_ALERT",
  LOGIN_2FA_CHALLENGE: "SECURITY_ALERT",
  "2FA_ENABLED": "SECURITY_ALERT",
  "2FA_DISABLED": "SECURITY_ALERT",
};

function humanizeAction(action: string): string {
  return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Best-effort broadcast of a CRM change (or auth/security event) to any
// Telegram group subscribed to the relevant event type. Fire-and-forget:
// never throws, and is only invoked AFTER the audit row is durably written
// outside of any in-flight transaction (see log() below) so we never
// notify about a change that could still be rolled back.
async function broadcastCrmUpdate(opts: { userId?: string | null; action: string; entity: string; entityId?: string | null; ipAddress?: string | null }) {
  if (BROADCAST_EXCLUDED_ACTIONS.has(opts.action)) return;
  try {
    const { TelegramService } = await import("./telegram");
    let who = "";
    if (opts.userId) {
      const user = await db.user.findUnique({ where: { id: opts.userId }, select: { name: true } }).catch(() => null);
      if (user) who = ` by ${user.name}`;
    }
    const eventType = AUTH_EVENT_TYPES[opts.action] ?? "CRM_UPDATE";
    const ipLine = opts.ipAddress ? `\n📍 IP: <code>${opts.ipAddress}</code>` : "";
    const message = eventType === "CRM_UPDATE"
      ? `🔄 <b>CRM Update</b>\n${humanizeAction(opts.action)} — ${opts.entity}${opts.entityId ? ` (${opts.entityId})` : ""}${who}`
      : `${eventType === "LOGIN_ALERT" ? "🔓" : eventType === "LOGOUT_ALERT" ? "🔒" : "🛡️"} <b>${humanizeAction(opts.action)}</b>${who ? `\n${who.trim()}` : ""}${ipLine}`;
    await TelegramService.routeNotification(eventType, message);
  } catch (e) {
    console.error("[AuditService] broadcastCrmUpdate failed:", e);
  }
}

// Audit logging service. All logs are immutable (no update/delete API exposed).
// When called from inside a service transaction, pass the `tx` client so the
// audit write happens in the SAME transaction — this avoids SQLite write-lock
// deadlocks that would occur if we opened a separate transaction mid-flight.
//
// SOURCE FIELD (Phase 4):
//   Every audit log can now record where the action originated:
//     WEB          — web dashboard (default when a session user is present)
//     WOOCOMMERCE  — WooCommerce webhook / sync
//     TELEGRAM     — Telegram bot command
//     API          — direct API call (no session, e.g. external integration)
//     SYSTEM       — cron worker / automation / internal service
//   Callers should pass `source` explicitly so the audit trail can answer
//   "did this ORDER_CREATE come from the web, a webhook, or Telegram?".
export const AuditService = {
  async log(
    opts: {
      userId?: string | null;
      action: string;
      entity: string;
      entityId?: string | null;
      changes?: unknown;
      ipAddress?: string | null;
      source?: string | null; // WEB | WOOCOMMERCE | TELEGRAM | API | SYSTEM
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
          source: opts.source ?? null,
        },
      });
      // Only broadcast outside a transaction: inside one, the write could
      // still be rolled back by the caller, and callers already send their
      // own precise Telegram notifications (order, payment, inventory,
      // lead) for transactional flows — see routeNotification() call sites.
      if (!tx) {
        void broadcastCrmUpdate({ userId: opts.userId, action: opts.action, entity: opts.entity, entityId: opts.entityId, ipAddress: opts.ipAddress });
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
  // Defaults source to "WEB" (callers can override).
  async logFromRequest(opts: {
    action: string;
    entity: string;
    entityId?: string | null;
    changes?: unknown;
    source?: string | null;
  }) {
    const user = await getCurrentUser();
    return AuditService.log({
      userId: user?.id,
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId,
      changes: opts.changes,
      ipAddress: null,
      source: opts.source ?? "WEB",
    });
  },

  async list(opts: { page: number; limit: number; search?: string; entity?: string; action?: string; userId?: string; source?: string }) {
    const { page, limit, search, entity, action, userId, source } = opts;
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
    if (source) and.push({ source });
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
