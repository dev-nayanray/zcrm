import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// NotificationService — basic in-app notifications. Designed so future
// email/WhatsApp delivery can be plugged in.
export const NotificationService = {
  async create(input: { type: string; title: string; message: string; link?: string; userId?: string }) {
    return db.notification.create({
      data: {
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        userId: input.userId,
      },
    });
  },

  // Scan business state & emit notifications for low stock, failed sync, etc.
  async refreshSystemNotifications() {
    const created: Awaited<ReturnType<typeof NotificationService.create>>[] = [];
    // Low stock
    const lowStock = await db.inventory.findMany({
      where: { product: { status: "ACTIVE" } },
      include: { product: { select: { name: true, sku: true, minimumStockLevel: true } } },
    });
    for (const inv of lowStock) {
      const qty = new Prisma.Decimal(inv.quantity);
      const min = new Prisma.Decimal(inv.product.minimumStockLevel);
      if (qty.lte(0) || qty.lte(min)) {
        // avoid spamming: only if none unread of same type for product
        const existing = await db.notification.findFirst({
          where: { type: "LOW_STOCK", link: `/inventory?product=${inv.productId}`, isRead: false },
        });
        if (!existing) {
          created.push(
            await this.create({
              type: "LOW_STOCK",
              title: qty.lte(0) ? "Out of stock" : "Low stock",
              message: `${inv.product.name} (${inv.product.sku}) has ${qty.toFixed(0)} units`,
              link: `/inventory?product=${inv.productId}`,
            }),
          );
        }
      }
    }
    // Failed syncs
    const failed = await db.syncLog.findMany({ where: { status: "FAILED" }, take: 5 });
    for (const f of failed) {
      const existing = await db.notification.findFirst({ where: { type: "SYNC_FAILED", link: `/integrations?log=${f.id}`, isRead: false } });
      if (!existing) {
        created.push(
          await this.create({
            type: "SYNC_FAILED",
            title: "Sync failed",
            message: `${f.entity} ${f.externalId}: ${f.message ?? "unknown error"}`,
            link: `/integrations?log=${f.id}`,
          }),
        );
      }
    }
    return created;
  },

  async listForUser(userId: string | undefined, opts: { page: number; limit: number; unreadOnly?: boolean }) {
    const where: Record<string, unknown> = { AND: [] };
    const and: Record<string, unknown>[] = [];
    // user-specific OR broadcast (userId null)
    and.push({ OR: [{ userId: userId ?? null }, { userId: null }] });
    if (opts.unreadOnly) and.push({ isRead: false });
    where.AND = and;
    const [items, total] = await Promise.all([
      db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.limit, take: opts.limit }),
      db.notification.count({ where }),
    ]);
    return { items, total };
  },

  // Mark a notification as read. Scoped by userId so a user can only mark
  // their own notifications (and broadcast notifications) as read. The
  // previous implementation accepted any id — an authenticated user with
  // notifications:read could mark ANY other user's notifications as read
  // (IDOR). Returns the updated row, or null if not found/not owned.
  async markRead(id: string, userId: string | undefined) {
    try {
      return await db.notification.update({
        where: { id, OR: [{ userId: userId ?? null }, { userId: null }] },
        data: { isRead: true },
      });
    } catch {
      return null;
    }
  },

  // Delete a notification. Same scoping as markRead — a user can only
  // delete their own notifications (and broadcasts).
  async delete(id: string, userId: string | undefined) {
    try {
      await db.notification.delete({
        where: { id, OR: [{ userId: userId ?? null }, { userId: null }] },
      });
      return true;
    } catch {
      return false;
    }
  },

  async markAllRead(userId: string | undefined) {
    return db.notification.updateMany({ where: { OR: [{ userId: userId ?? null }, { userId: null }], isRead: false }, data: { isRead: true } });
  },
};
