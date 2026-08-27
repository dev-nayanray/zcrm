import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";
import { OrderService } from "./order";
import { AuditService } from "./audit";
import { getCurrentUser } from "@/lib/auth";

// WooCommerceService — handles sync between WooCommerce and the CRM.
//
// IMPORTANT: webhook processing is idempotent. If WooCommerce sends the same
// webhook multiple times, we look up by externalId and update (not duplicate).
// SyncLog rows are upserted keyed by (entity, externalId, operation) so retries
// update the same row instead of creating duplicates.
//
// Credentials are stored in the Integration.config JSON. The consumer secret
// is NEVER sent to the client (the GET endpoint returns only masked metadata).

export type WooConfig = {
  url: string;
  consumerKey: string;
  consumerSecret: string;
  webhookSecret: string;
};

export const WooCommerceService = {
  async getConfig(): Promise<WooConfig | null> {
    const integ = await db.integration.findUnique({ where: { name: "woocommerce" } });
    if (!integ) return null;
    try {
      const cfg = JSON.parse(integ.config) as WooConfig;
      return cfg;
    } catch {
      return null;
    }
  },

  async saveConfig(cfg: Partial<WooConfig>) {
    // Merge with existing config so empty/omitted fields keep their previous
    // value. This lets a user update just the URL without re-entering the
    // consumer secret (which is never returned to the client).
    const existing = await this.getConfig();
    const merged: WooConfig = {
      url: cfg.url !== undefined && cfg.url !== "" ? cfg.url : (existing?.url ?? ""),
      consumerKey: cfg.consumerKey !== undefined && cfg.consumerKey !== "" ? cfg.consumerKey : (existing?.consumerKey ?? ""),
      consumerSecret: cfg.consumerSecret !== undefined && cfg.consumerSecret !== "" ? cfg.consumerSecret : (existing?.consumerSecret ?? ""),
      webhookSecret: cfg.webhookSecret !== undefined && cfg.webhookSecret !== "" ? cfg.webhookSecret : (existing?.webhookSecret ?? ""),
    };
    const data = JSON.stringify(merged);
    const integ = await db.integration.upsert({
      where: { name: "woocommerce" },
      create: { name: "woocommerce", config: data, status: "DISCONNECTED" },
      update: { config: data },
    });
    return integ;
  },

  async setStatus(status: string) {
    return db.integration.update({ where: { name: "woocommerce" }, data: { status } });
  },

  async setLastSync() {
    return db.integration.update({ where: { name: "woocommerce" }, data: { lastSyncAt: new Date() } });
  },

  async testConnection(cfg: WooConfig): Promise<{ ok: boolean; message: string }> {
    try {
      const url = `${cfg.url.replace(/\/$/, "")}/wp-json/wc/v3/system_status?consumer_key=${encodeURIComponent(cfg.consumerKey)}&consumer_secret=${encodeURIComponent(cfg.consumerSecret)}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      return { ok: true, message: "Connected" };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  async upsertSyncLog(input: { entity: string; externalId: string; operation: string; status: string; message?: string; payload?: unknown }) {
    return db.syncLog.upsert({
      where: { entity_externalId_operation: { entity: input.entity, externalId: String(input.externalId), operation: input.operation } },
      create: {
        entity: input.entity,
        externalId: String(input.externalId),
        operation: input.operation,
        status: input.status,
        message: input.message,
        payload: input.payload ? JSON.stringify(input.payload) : null,
      },
      update: {
        status: input.status,
        message: input.message,
        attemptCount: { increment: 1 },
        payload: input.payload ? JSON.stringify(input.payload) : undefined,
      },
    });
  },

  // Sync a single WooCommerce product into the CRM. Idempotent by externalId.
  async syncProduct(wooProduct: { id: number; name: string; sku?: string; regular_price?: string; sale_price?: string; stock_quantity?: number | null; type?: string }) {
    const sku = wooProduct.sku || `WOO-${wooProduct.id}`;
    const sellingPrice = toDecimal(wooProduct.sale_price || wooProduct.regular_price || 0);
    const existing = await db.product.findFirst({ where: { externalId: String(wooProduct.id) } });
    const data = {
      sku,
      name: wooProduct.name,
      slug: `${wooProduct.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-${wooProduct.id}`,
      sellingPrice,
      status: "ACTIVE" as const,
      externalId: String(wooProduct.id),
    };
    let product;
    if (existing) {
      product = await db.product.update({ where: { id: existing.id }, data: { ...data, sku: existing.sku } });
    } else {
      // ensure sku is unique; if collision, append
      const existingSku = await db.product.findUnique({ where: { sku } });
      if (existingSku) data.sku = `${sku}-${wooProduct.id}`;
      product = await db.product.create({ data });
    }
    await this.upsertSyncLog({ entity: "product", externalId: String(wooProduct.id), operation: "sync", status: "SUCCESS", payload: { sku } });
    return product;
  },

  // Sync a WooCommerce customer. Idempotent by (phone) / externalId.
  async syncCustomer(wooCustomer: { id: number; first_name?: string; last_name?: string; email?: string; billing?: { phone?: string; address_1?: string; city?: string } }) {
    const name = `${wooCustomer.first_name ?? ""} ${wooCustomer.last_name ?? ""}`.trim() || wooCustomer.email || `WOO-${wooCustomer.id}`;
    const phone = wooCustomer.billing?.phone || `WOO-${wooCustomer.id}`;
    const existingByExt = await db.customer.findFirst({ where: { externalId: String(wooCustomer.id) } });
    const data = {
      name,
      phone,
      email: wooCustomer.email,
      address: wooCustomer.billing?.address_1,
      city: wooCustomer.billing?.city,
      externalId: String(wooCustomer.id),
    };
    let customer;
    if (existingByExt) {
      customer = await db.customer.update({ where: { id: existingByExt.id }, data });
    } else {
      const existingByPhone = await db.customer.findUnique({ where: { phone } });
      if (existingByPhone) {
        customer = await db.customer.update({ where: { id: existingByPhone.id }, data: { ...data, externalId: String(wooCustomer.id) } });
      } else {
        customer = await db.customer.create({ data });
      }
    }
    await this.upsertSyncLog({ entity: "customer", externalId: String(wooCustomer.id), operation: "sync", status: "SUCCESS" });
    return customer;
  },

  // Sync a WooCommerce order. Idempotent by externalId on the Order table.
  async syncOrder(wooOrder: {
    id: number;
    number?: string;
    status?: string;
    customer_id?: number;
    billing?: { first_name?: string; last_name?: string; phone?: string; email?: string; address_1?: string; city?: string };
    line_items?: { product_id?: number; quantity?: number; total?: string }[];
    discount_total?: string;
    shipping_total?: string;
    total?: string;
    payment_method?: string;
  }) {
    // Idempotency: if order already synced, update minimal fields & log.
    const externalId = String(wooOrder.id);
    const existing = await db.order.findFirst({ where: { externalId } });
    if (existing) {
      await this.upsertSyncLog({ entity: "order", externalId, operation: "sync", status: "SUCCESS", message: "Already synced" });
      return existing;
    }

    // Resolve customer (sync if missing)
    let customerId: string;
    if (wooOrder.customer_id && wooOrder.customer_id !== 0) {
      const c = await db.customer.findFirst({ where: { externalId: String(wooOrder.customer_id) } });
      if (c) customerId = c.id;
      else {
        const created = await this.syncCustomer({
          id: wooOrder.customer_id,
          first_name: wooOrder.billing?.first_name,
          last_name: wooOrder.billing?.last_name,
          email: wooOrder.billing?.email,
          billing: { phone: wooOrder.billing?.phone, address_1: wooOrder.billing?.address_1, city: wooOrder.billing?.city },
        });
        customerId = created.id;
      }
    } else {
      // guest checkout — create/find customer by billing details
      const phone = wooOrder.billing?.phone || `WOO-GUEST-${wooOrder.id}`;
      const name = `${wooOrder.billing?.first_name ?? ""} ${wooOrder.billing?.last_name ?? ""}`.trim() || "Guest";
      let c = await db.customer.findUnique({ where: { phone } });
      if (!c) {
        c = await db.customer.create({
          data: { name, phone, email: wooOrder.billing?.email, address: wooOrder.billing?.address_1, city: wooOrder.billing?.city },
        });
      }
      customerId = c.id;
    }

    // Resolve order items from CRM products by externalId (= woo product id)
    const items: { productId: string; quantity: Prisma.Decimal }[] = [];
    for (const li of wooOrder.line_items ?? []) {
      if (!li.product_id) continue;
      const product = await db.product.findFirst({ where: { externalId: String(li.product_id) } });
      if (!product) continue;
      items.push({ productId: product.id, quantity: toDecimal(li.quantity ?? 1) });
    }
    if (items.length === 0) {
      await this.upsertSyncLog({ entity: "order", externalId, operation: "sync", status: "FAILED", message: "No matching products" });
      throw new Error("Order has no matching products");
    }

    // Find website channel
    let websiteChannel = await db.channel.findFirst({ where: { name: "Website" } });
    if (!websiteChannel) websiteChannel = await db.channel.create({ data: { name: "Website", isSystem: true } });

    const order = await OrderService.create({
      customerId,
      channelId: websiteChannel.id,
      status: "CONFIRMED",
      discount: toDecimal(wooOrder.discount_total ?? 0),
      shippingCost: toDecimal(wooOrder.shipping_total ?? 0),
      otherCost: 0,
      notes: `Synced from WooCommerce #${wooOrder.number ?? wooOrder.id}`,
      sourceChannel: "Website",
      externalId,
      syncStatus: "SYNCED",
      items,
      payment: wooOrder.total ? {
        amount: toDecimal(wooOrder.total),
        method: wooOrder.payment_method || "OTHER",
      } : undefined,
    });

    await this.upsertSyncLog({ entity: "order", externalId, operation: "sync", status: "SUCCESS", payload: { orderId: order?.id } });
    await this.setLastSync();
    return order;
  },

  // Bulk sync: pull products from Woo and upsert. Retries up to 3 pages.
  async bulkSyncProducts() {
    const cfg = await this.getConfig();
    if (!cfg) throw new Error("WooCommerce not configured");
    await this.setStatus("CONNECTED");
    let page = 1;
    let synced = 0;
    while (page <= 3) {
      const url = `${cfg.url.replace(/\/$/, "")}/wp-json/wc/v3/products?per_page=20&page=${page}&consumer_key=${encodeURIComponent(cfg.consumerKey)}&consumer_secret=${encodeURIComponent(cfg.consumerSecret)}`;
      const res = await fetch(url);
      if (!res.ok) break;
      const products = (await res.json()) as { id: number; name: string; sku?: string; regular_price?: string; sale_price?: string }[];
      if (!products.length) break;
      for (const p of products) {
        try {
          await this.syncProduct(p);
          synced++;
        } catch (e) {
          await this.upsertSyncLog({ entity: "product", externalId: String(p.id), operation: "sync", status: "FAILED", message: (e as Error).message });
        }
      }
      page++;
    }
    await this.setLastSync();
    await AuditService.log({ userId: (await getCurrentUser())?.id, action: "WOOCOMMERCE_SYNC", entity: "Integration", entityId: "woocommerce", changes: { type: "products", synced } });
    return { synced };
  },

  async bulkSyncOrders() {
    const cfg = await this.getConfig();
    if (!cfg) throw new Error("WooCommerce not configured");
    let page = 1;
    let synced = 0;
    while (page <= 3) {
      const url = `${cfg.url.replace(/\/$/, "")}/wp-json/wc/v3/orders?per_page=20&page=${page}&consumer_key=${encodeURIComponent(cfg.consumerKey)}&consumer_secret=${encodeURIComponent(cfg.consumerSecret)}`;
      const res = await fetch(url);
      if (!res.ok) break;
      const orders = (await res.json()) as any[];
      if (!orders.length) break;
      for (const o of orders) {
        try {
          await this.syncOrder(o);
          synced++;
        } catch (e) {
          await this.upsertSyncLog({ entity: "order", externalId: String(o.id), operation: "sync", status: "FAILED", message: (e as Error).message });
        }
      }
      page++;
    }
    await this.setLastSync();
    await AuditService.log({ userId: (await getCurrentUser())?.id, action: "WOOCOMMERCE_SYNC", entity: "Integration", entityId: "woocommerce", changes: { type: "orders", synced } });
    return { synced };
  },

  async listSyncLogs(opts: { page: number; limit: number; entity?: string; status?: string }) {
    const where: Record<string, unknown> = { AND: [] };
    const and: Record<string, unknown>[] = [];
    if (opts.entity) and.push({ entity: opts.entity });
    if (opts.status) and.push({ status: opts.status });
    where.AND = and;
    const [items, total] = await Promise.all([
      db.syncLog.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (opts.page - 1) * opts.limit, take: opts.limit }),
      db.syncLog.count({ where }),
    ]);
    return { items, total };
  },
};
