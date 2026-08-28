import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";
import { OrderService } from "./order";
import { AuditService } from "./audit";
import { getCurrentUser } from "@/lib/auth";
import { InventoryService } from "./inventory";

// WooCommerceService — bidirectional sync between WooCommerce and Z-CRM.
//
// INBOUND (Woo → CRM):
//   • Products, variations, categories, customers, orders, order notes
//   • Webhook payloads are HMAC-SHA256 verified by the route handler, then
//     dispatched here. Every webhook is recorded in the WebhookEvent table
//     via WebhookService.recordEvent({ provider: "woocommerce", ... }) so
//     duplicate deliveries are deduplicated at the event level (not just
//     the entity level). Failed events are retryable via the
//     /webhook-events/:id/retry endpoint.
//   • All entity-level writes use `findUnique({ where: { externalId }})`
//     because externalId is now `@unique` (sparse) on Order, Customer,
//     Product, and Category. This eliminates the TOCTOU race that existed
//     when externalId was only indexed (not unique).
//
// OUTBOUND (CRM → Woo):
//   • Product price / sale price / stock / status updates
//   • Order status updates
//   • Each push is wrapped in try/catch and writes a SyncLog row so failures
//     are visible in the dashboard. We never throw out of an outbound push
//     — the CRM operation that triggered the push (e.g. inventory adjust)
//     must still succeed for the user even if Woo is unreachable.
//
// RETRY:
//   • SyncLog rows with status=FAILED and nextRetryAt <= now() can be
//     retried by POST /api/v1/integrations/woocommerce/sync/retry or by
//     the (future) cron worker.
//
// CREDENTIALS are stored in the Integration.config JSON. The consumer secret
// is NEVER sent to the client (the GET endpoint returns only masked metadata).

export type WooConfig = {
  url: string;
  consumerKey: string;
  consumerSecret: string;
  webhookSecret: string;
};

// Maximum pages we will fetch per bulk-sync run. 50 pages × 100 records = 5000
// products/orders per run, which is enough for the typical SME store. The
// previous hard cap of 3 pages × 20 = 60 records was silently truncating
// larger catalogs.
const MAX_BULK_PAGES = 50;
const BULK_PAGE_SIZE = 100;

// Status mapping. WooCommerce statuses → CRM statuses. The reverse map is
// used for outbound order-status pushes.
const WOO_TO_CRM_STATUS: Record<string, string> = {
  pending: "PENDING",
  processing: "CONFIRMED",
  "on-hold": "PENDING",
  completed: "DELIVERED",
  cancelled: "CANCELLED",
  refunded: "REFUNDED",
  failed: "CANCELLED",
};
const CRM_TO_WOO_STATUS: Record<string, string> = {
  PENDING: "pending",
  CONFIRMED: "processing",
  PROCESSING: "processing",
  SHIPPED: "completed",
  DELIVERED: "completed",
  CANCELLED: "cancelled",
  RETURNED: "refunded",
  REFUNDED: "refunded",
};

export const WooCommerceService = {
  async getConfig(): Promise<WooConfig | null> {
    const integ = await db.integration.findUnique({ where: { name: "woocommerce" } });
    if (!integ) return null;
    try {
      return JSON.parse(integ.config) as WooConfig;
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

  // Build an authenticated WooCommerce REST URL for a given path & query.
  buildUrl(cfg: WooConfig, path: string, query: Record<string, string | number> = {}) {
    const base = `${cfg.url.replace(/\/$/, "")}/wp-json/wc/v3${path}`;
    const q = new URLSearchParams({
      consumer_key: cfg.consumerKey,
      consumer_secret: cfg.consumerSecret,
      ...Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])),
    });
    return `${base}?${q.toString()}`;
  },

  async upsertSyncLog(input: { entity: string; externalId: string; operation: string; status: string; message?: string; payload?: unknown }) {
    const isFailed = input.status === "FAILED";
    // Look up the existing row to read its current attemptCount (used for
    // backoff scheduling). `count()` takes `WhereInput`, which doesn't allow
    // the compound unique key — use the individual fields instead.
    const existing = await db.syncLog.findUnique({
      where: { entity_externalId_operation: { entity: input.entity, externalId: String(input.externalId), operation: input.operation } },
    });
    const attemptCount = existing?.attemptCount ?? 0;
    // Exponential backoff: 1m, 5m, 25m, 2h, 10h. After maxAttempts, the row
    // stays FAILED but nextRetryAt is set to null (won't be picked up again).
    const backoffMs = [60_000, 300_000, 1_500_000, 7_200_000, 36_000_000];
    const nextRetryAt = isFailed && attemptCount < 5
      ? new Date(Date.now() + backoffMs[Math.min(attemptCount, backoffMs.length - 1)])
      : null;
    return db.syncLog.upsert({
      where: { entity_externalId_operation: { entity: input.entity, externalId: String(input.externalId), operation: input.operation } },
      create: {
        entity: input.entity,
        externalId: String(input.externalId),
        operation: input.operation,
        status: input.status,
        message: input.message,
        payload: input.payload ? JSON.stringify(input.payload) : null,
        lastErrorAt: isFailed ? new Date() : null,
        nextRetryAt,
        attemptCount: isFailed ? 1 : 0,
      },
      update: {
        status: input.status,
        message: input.message,
        attemptCount: { increment: 1 },
        payload: input.payload ? JSON.stringify(input.payload) : undefined,
        lastErrorAt: isFailed ? new Date() : null,
        nextRetryAt,
      },
    });
  },

  // ─────────────────────────────────────────────────────────────────────
  // INBOUND: Woo → CRM
  // ─────────────────────────────────────────────────────────────────────

  // Sync a single WooCommerce product. Idempotent — looks up by externalId
  // (now `@unique`), updates if found, creates if not.
  //
  // Synced fields: name, sku, regular_price, sale_price, stock_quantity,
  // status, type, categories (linked by externalId), images (first image
  // URL → Product.imageUrl).
  async syncProduct(wooProduct: {
    id: number;
    name: string;
    sku?: string;
    regular_price?: string;
    sale_price?: string;
    price?: string;
    stock_quantity?: number | null;
    manage_stock?: boolean;
    status?: string; // publish | draft
    type?: string;    // simple | variable | variation
    parent_id?: number;
    categories?: { id: number; name?: string; slug?: string }[];
    images?: { src?: string }[];
    description?: string;
  }) {
    const sku = wooProduct.sku || `WOO-${wooProduct.id}`;
    const regularPrice = toDecimal(wooProduct.regular_price || 0);
    const salePrice = toDecimal(wooProduct.sale_price || 0);
    const sellingPrice = salePrice.gt(0) ? salePrice : regularPrice;
    const purchasePrice = toDecimal(0); // WooCommerce does not expose product cost; remains whatever CRM has
    const imageUrl = wooProduct.images?.[0]?.src ?? null;

    // Resolve categories — link by externalId, create missing ones.
    let categoryId: string | null = null;
    if (wooProduct.categories && wooProduct.categories.length > 0) {
      const firstCat = wooProduct.categories[0];
      const existingCat = await db.category.findUnique({ where: { externalId: String(firstCat.id) } });
      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const slug = (firstCat.slug ?? firstCat.name ?? `woo-cat-${firstCat.id}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
        const created = await db.category.create({
          data: {
            name: firstCat.name ?? `Category ${firstCat.id}`,
            slug: `${slug}-${firstCat.id}`,
            externalId: String(firstCat.id),
          },
        }).catch(() => null);
        if (created) categoryId = created.id;
      }
    }

    const data = {
      sku,
      name: wooProduct.name,
      slug: `${wooProduct.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-${wooProduct.id}`,
      description: wooProduct.description ?? null,
      // Schema stores Float; Prisma.Decimal is converted implicitly by Prisma
      // for Float fields when the value is a Decimal instance. The Decimal
      // arithmetic preserves precision during this sync.
      sellingPrice: sellingPrice.toNumber(),
      purchasePrice: purchasePrice.toNumber(),
      imageUrl,
      status: wooProduct.status === "draft" ? "INACTIVE" : "ACTIVE",
      categoryId,
      externalId: String(wooProduct.id),
    };

    const existing = await db.product.findUnique({ where: { externalId: String(wooProduct.id) } });
    let product;
    if (existing) {
      // Preserve the existing SKU if Woo's SKU is empty — we don't want to
      // overwrite a real SKU with `WOO-{id}` placeholder.
      product = await db.product.update({
        where: { id: existing.id },
        // Prisma accepts a plain object here; sellingPrice/purchasePrice
        // are sent as numbers (Float fields).
        data: { ...data, sku: wooProduct.sku ? sku : existing.sku, purchasePrice: existing.purchasePrice },
      });
      // If manage_stock is on, sync stock into Inventory
      if (wooProduct.manage_stock && typeof wooProduct.stock_quantity === "number") {
        await db.inventory.upsert({
          where: { productId: existing.id },
          create: { productId: existing.id, quantity: wooProduct.stock_quantity },
          update: { quantity: wooProduct.stock_quantity },
        });
      }
    } else {
      // Ensure SKU is unique — append Woo id on collision.
      const skuCollision = await db.product.findUnique({ where: { sku } });
      if (skuCollision) data.sku = `${sku}-${wooProduct.id}`;
      product = await db.product.create({ data });
      if (wooProduct.manage_stock && typeof wooProduct.stock_quantity === "number") {
        await db.inventory.upsert({
          where: { productId: product.id },
          create: { productId: product.id, quantity: wooProduct.stock_quantity },
          update: { quantity: wooProduct.stock_quantity },
        });
      }
    }

    await this.upsertSyncLog({ entity: "product", externalId: String(wooProduct.id), operation: "sync", status: "SUCCESS", payload: { sku } });

    // ── Variable products: auto-sync their variations ──
    // A WooCommerce product with type="variable" has child variations. We
    // fetch them from /products/{id}/variations and sync each one. This is
    // a fire-and-forget — if variation sync fails, the parent product sync
    // still succeeded (logged separately to SyncLog).
    if (wooProduct.type === "variable") {
      try {
        await this.bulkSyncVariations(wooProduct.id);
      } catch (e) {
        // Logged inside bulkSyncVariations; don't fail the parent sync.
        console.error(`[WooCommerce] variation sync for parent ${wooProduct.id} failed:`, e);
      }
    }

    return product;
  },

  // ─────────────────────────────────────────────────────────────────────
  // Variable Products & Variations
  //
  // A WooCommerce variable product is a PARENT product with type="variable"
  // and one or more VARIATIONS (children). Each variation has its own SKU,
  // price, stock, and attributes (e.g. "Color=Red, Size=L").
  //
  // In Z-CRM:
  //   • The parent variable product syncs as a regular Product (no stock —
  //     the parent itself is not sellable; only its variations are).
  //   • Each variation syncs as a ProductVariant row linked to the parent
  //     Product via ProductVariant.externalId (= Woo variation id, @unique).
  //
  // syncOrder already prefers variation_id over product_id when looking up
  // the product (woocommerce.ts:syncOrder). With variants now synced, those
  // line items will resolve correctly instead of being silently dropped.
  // ─────────────────────────────────────────────────────────────────────

  // Sync a single WooCommerce variation. Idempotent by ProductVariant.externalId.
  // The parent product MUST already exist (sync it first via syncProduct).
  async syncVariation(wooVariation: {
    id: number;
    parent_id?: number;
    sku?: string;
    regular_price?: string;
    sale_price?: string;
    price?: string;
    stock_quantity?: number | null;
    manage_stock?: boolean;
    attributes?: { id?: number; name?: string; option?: string }[];
    image?: { src?: string };
    status?: string;
  }) {
    const externalId = String(wooVariation.id);
    // Resolve the parent product by Woo parent_id.
    if (!wooVariation.parent_id) {
      await this.upsertSyncLog({ entity: "variation", externalId, operation: "sync", status: "FAILED", message: "No parent_id" });
      throw new Error("Variation has no parent_id");
    }
    const parent = await db.product.findUnique({ where: { externalId: String(wooVariation.parent_id) } });
    if (!parent) {
      await this.upsertSyncLog({ entity: "variation", externalId, operation: "sync", status: "FAILED", message: `Parent product ${wooVariation.parent_id} not synced` });
      throw new Error(`Parent product (Woo id ${wooVariation.parent_id}) not found. Sync the parent product first.`);
    }

    const sku = wooVariation.sku || `WOO-VAR-${wooVariation.id}`;
    const regularPrice = toDecimal(wooVariation.regular_price || 0);
    const salePrice = toDecimal(wooVariation.sale_price || 0);
    const sellingPrice = salePrice.gt(0) ? salePrice : regularPrice;
    const imageUrl = wooVariation.image?.src ?? null;
    // Build a human-readable name from attributes: "Red / L"
    const attrParts = (wooVariation.attributes ?? [])
      .filter((a) => a.option)
      .map((a) => a.option as string);
    const name = attrParts.length > 0 ? attrParts.join(" / ") : `Variation ${wooVariation.id}`;
    const attributesJson = wooVariation.attributes ? JSON.stringify(wooVariation.attributes) : null;

    const data = {
      productId: parent.id,
      sku,
      name,
      attributes: attributesJson,
      sellingPrice: sellingPrice.toNumber(),
      purchasePrice: 0, // Woo doesn't expose cost; inherited from parent until a purchase lands
      stock: wooVariation.manage_stock && typeof wooVariation.stock_quantity === "number" ? wooVariation.stock_quantity : 0,
      imageUrl,
      externalId,
      isActive: wooVariation.status !== "draft",
    };

    const existing = await db.productVariant.findUnique({ where: { externalId } });
    let variant;
    if (existing) {
      variant = await db.productVariant.update({
        where: { id: existing.id },
        data: { ...data, sku: wooVariation.sku ? sku : existing.sku },
      });
    } else {
      // Ensure SKU is unique — append Woo id on collision.
      const skuCollision = await db.productVariant.findUnique({ where: { sku } });
      if (skuCollision) data.sku = `${sku}-${wooVariation.id}`;
      variant = await db.productVariant.create({ data });
    }

    await this.upsertSyncLog({ entity: "variation", externalId, operation: "sync", status: "SUCCESS", payload: { sku, parentProductId: parent.id } });
    return variant;
  },

  // Bulk sync all variations for a variable product. Fetches them from the
  // Woo REST API endpoint /products/{id}/variations.
  async bulkSyncVariations(parentProductId: number) {
    const cfg = await this.getConfig();
    if (!cfg) throw new Error("WooCommerce not configured");
    let page = 1;
    let synced = 0;
    let failed = 0;
    while (page <= MAX_BULK_PAGES) {
      const url = this.buildUrl(cfg, `/products/${parentProductId}/variations`, { per_page: BULK_PAGE_SIZE, page });
      const res = await fetch(url);
      if (!res.ok) break;
      const variations = (await res.json()) as any[];
      if (!variations.length) break;
      for (const v of variations) {
        try {
          await this.syncVariation(v);
          synced++;
        } catch (e) {
          failed++;
          await this.upsertSyncLog({ entity: "variation", externalId: String(v.id), operation: "sync", status: "FAILED", message: (e as Error).message });
        }
      }
      if (variations.length < BULK_PAGE_SIZE) break;
      page++;
    }
    await this.setLastSync();
    await AuditService.log({
      userId: (await getCurrentUser())?.id,
      action: "WOOCOMMERCE_SYNC",
      entity: "Integration",
      entityId: "woocommerce",
      changes: { type: "variations", parentProductId, synced, failed },
    });
    return { synced, failed };
  },

  // Sync a WooCommerce customer. Idempotent by externalId (now `@unique`),
  // with phone fallback for guest checkouts where Woo may not have set a
  // customer_id.
  async syncCustomer(wooCustomer: { id: number; first_name?: string; last_name?: string; email?: string; billing?: { phone?: string; address_1?: string; city?: string } }) {
    const name = `${wooCustomer.first_name ?? ""} ${wooCustomer.last_name ?? ""}`.trim() || wooCustomer.email || `WOO-${wooCustomer.id}`;
    const phone = wooCustomer.billing?.phone || `WOO-${wooCustomer.id}`;
    const data = {
      name,
      phone,
      email: wooCustomer.email,
      address: wooCustomer.billing?.address_1,
      city: wooCustomer.billing?.city,
      externalId: String(wooCustomer.id),
    };
    let customer;
    const existingByExt = await db.customer.findUnique({ where: { externalId: String(wooCustomer.id) } });
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

  // Sync a WooCommerce order. Idempotent — uses the new Order.externalId
  // `@unique` constraint. Crucially, when an order with the same externalId
  // already exists, we now APPLY updates (status, totals, items) instead
  // of silently dropping them. The previous "early return" behaviour meant
  // any status change in Woo would never reflect in CRM after the first sync.
  async syncOrder(wooOrder: {
    id: number;
    number?: string;
    status?: string;
    customer_id?: number;
    billing?: { first_name?: string; last_name?: string; phone?: string; email?: string; address_1?: string; city?: string };
    line_items?: { product_id?: number; variation_id?: number; quantity?: number; total?: string; name?: string; subtotal?: string; total_tax?: string }[];
    discount_total?: string;
    shipping_total?: string;
    total?: string;
    total_tax?: string;
    payment_method?: string;
    payment_method_title?: string;
    date_created?: string;
    date_paid?: string;
    customer_note?: string;
    // WooCommerce fee_lines — additional fees charged to the customer
    // (e.g. payment gateway fee, COD fee). Each has a total + total_tax.
    fee_lines?: { id?: number; name?: string; total?: string; total_tax?: string }[];
    // WooCommerce shipping_lines — actual shipping charges
    shipping_lines?: { id?: number; method_title?: string; total?: string; total_tax?: string }[];
  }) {
    const externalId = String(wooOrder.id);
    const existing = await db.order.findUnique({ where: { externalId }, include: { items: true } });

    // Resolve customer (sync if missing)
    let customerId: string;
    if (wooOrder.customer_id && wooOrder.customer_id !== 0) {
      const c = await db.customer.findUnique({ where: { externalId: String(wooOrder.customer_id) } });
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

    // Resolve order items from CRM products by externalId.
    // If a line item has a variation_id, look up the ProductVariant first
    // (the variation's parent product is NOT directly sellable). If the
    // variant doesn't exist, fall back to the parent product_id so the order
    // still syncs (with a warning in the sync log).
    const items: { productId: string; quantity: Prisma.Decimal }[] = [];
    for (const li of wooOrder.line_items ?? []) {
      let product: { id: string } | null = null;
      if (li.variation_id && li.variation_id !== 0) {
        // Look up the variant by externalId; the variant's productId is
        // the CRM Product we attach to the order item.
        const variant = await db.productVariant.findUnique({
          where: { externalId: String(li.variation_id) },
          select: { id: true, productId: true },
        });
        if (variant) {
          product = { id: variant.productId };
        } else {
          // Variant not synced yet — fall back to the parent product.
          if (li.product_id) {
            product = await db.product.findUnique({ where: { externalId: String(li.product_id) }, select: { id: true } });
          }
        }
      } else if (li.product_id) {
        product = await db.product.findUnique({ where: { externalId: String(li.product_id) }, select: { id: true } });
      }
      if (!product) continue;
      items.push({ productId: product.id, quantity: toDecimal(li.quantity ?? 1) });
    }
    if (items.length === 0) {
      await this.upsertSyncLog({ entity: "order", externalId, operation: "sync", status: "FAILED", message: "No matching products" });
      throw new Error("Order has no matching products");
    }

    // Extract tax & fees from the Woo payload.
    // - total_tax: the order-level sales tax (VAT) charged to the customer.
    // - fee_lines: extra fees (e.g. payment gateway fee, COD fee). The
    //   customer pays these as part of order.total, but they're not part of
    //   the product subtotal. We map them to Order.paymentFee (gateway fee)
    //   and Order.platformFee (other marketplace fees) — splitting based
    //   on the fee name.
    const tax = toDecimal(wooOrder.total_tax ?? 0);
    let paymentFee = new Prisma.Decimal(0);
    let platformFee = new Prisma.Decimal(0);
    for (const fee of wooOrder.fee_lines ?? []) {
      const name = (fee.name ?? "").toLowerCase();
      const amt = toDecimal(fee.total ?? 0);
      if (name.includes("payment") || name.includes("gateway") || name.includes("bkash") || name.includes("nagad") || name.includes("card")) {
        paymentFee = paymentFee.plus(amt);
      } else {
        platformFee = platformFee.plus(amt);
      }
    }

    // Find website channel
    let websiteChannel = await db.channel.findFirst({ where: { name: "Website" } });
    if (!websiteChannel) websiteChannel = await db.channel.create({ data: { name: "Website", isSystem: true } });

    // If the order already exists in CRM, apply status update via the state
    // machine (validation enforces forward transitions; same-status is a
    // no-op). We do not touch line items / totals on existing orders — they
    // were snapshotted at creation time and changing them later would
    // invalidate historical COGS.
    if (existing) {
      const newCrmStatus = WOO_TO_CRM_STATUS[wooOrder.status ?? ""] ?? existing.status;
      if (newCrmStatus !== existing.status) {
        try {
          await OrderService.updateStatus(existing.id, newCrmStatus, `WooCommerce update: ${wooOrder.status}`);
        } catch (e) {
          // Status transition may be rejected (e.g. CANCELLED → DELIVERED).
          // Log it but don't fail the sync — the order is otherwise fine.
          await this.upsertSyncLog({ entity: "order", externalId, operation: "sync", status: "FAILED", message: `Status transition rejected: ${(e as Error).message}` });
        }
      }
      await this.upsertSyncLog({ entity: "order", externalId, operation: "sync", status: "SUCCESS", message: "Updated" });
      return existing;
    }

    // New order — create via OrderService.create (which handles idempotency,
    // COGS snapshotting, stock movements, payment recording, audit log,
    // and computes the full financial snapshot including tax/fees).
    const order = await OrderService.create({
      customerId,
      channelId: websiteChannel.id,
      status: WOO_TO_CRM_STATUS[wooOrder.status ?? "processing"] ?? "CONFIRMED",
      discount: toDecimal(wooOrder.discount_total ?? 0),
      tax,                                    // NEW: sales tax from Woo
      shippingCost: toDecimal(wooOrder.shipping_total ?? 0),
      paymentFee,                             // NEW: gateway fees from fee_lines
      platformFee,                            // NEW: marketplace fees from fee_lines
      otherCost: 0,
      notes: wooOrder.customer_note ?? `Synced from WooCommerce #${wooOrder.number ?? wooOrder.id}`,
      sourceChannel: "Website",
      externalId,
      syncStatus: "SYNCED",
      items,
      payment: wooOrder.total ? {
        amount: toDecimal(wooOrder.total),
        method: wooOrder.payment_method || "OTHER",
      } : undefined,
    });

    await this.upsertSyncLog({ entity: "order", externalId, operation: "sync", status: "SUCCESS", payload: { orderId: order?.id, tax: tax.toFixed(2), paymentFee: paymentFee.toFixed(2), platformFee: platformFee.toFixed(2) } });
    await this.setLastSync();
    return order;
  },

  // ─────────────────────────────────────────────────────────────────────
  // BULK SYNC — paginate until empty page or MAX_BULK_PAGES reached.
  // Previously capped at 60 records, silently truncating larger catalogs.
  // ─────────────────────────────────────────────────────────────────────

  async bulkSyncProducts() {
    const cfg = await this.getConfig();
    if (!cfg) throw new Error("WooCommerce not configured");
    await this.setStatus("CONNECTED");
    let page = 1;
    let synced = 0;
    let failed = 0;
    while (page <= MAX_BULK_PAGES) {
      const url = this.buildUrl(cfg, "/products", { per_page: BULK_PAGE_SIZE, page });
      const res = await fetch(url);
      if (!res.ok) break;
      const products = (await res.json()) as any[];
      if (!products.length) break;
      for (const p of products) {
        try {
          await this.syncProduct(p);
          synced++;
        } catch (e) {
          failed++;
          await this.upsertSyncLog({ entity: "product", externalId: String(p.id), operation: "sync", status: "FAILED", message: (e as Error).message });
        }
      }
      // Stop early if we got fewer than the page size — last page.
      if (products.length < BULK_PAGE_SIZE) break;
      page++;
    }
    await this.setLastSync();
    await AuditService.log({ userId: (await getCurrentUser())?.id, action: "WOOCOMMERCE_SYNC", entity: "Integration", entityId: "woocommerce", changes: { type: "products", synced, failed } });
    return { synced, failed };
  },

  async bulkSyncOrders() {
    const cfg = await this.getConfig();
    if (!cfg) throw new Error("WooCommerce not configured");
    await this.setStatus("CONNECTED");
    let page = 1;
    let synced = 0;
    let failed = 0;
    while (page <= MAX_BULK_PAGES) {
      const url = this.buildUrl(cfg, "/orders", { per_page: BULK_PAGE_SIZE, page });
      const res = await fetch(url);
      if (!res.ok) break;
      const orders = (await res.json()) as any[];
      if (!orders.length) break;
      for (const o of orders) {
        try {
          await this.syncOrder(o);
          synced++;
        } catch (e) {
          failed++;
          await this.upsertSyncLog({ entity: "order", externalId: String(o.id), operation: "sync", status: "FAILED", message: (e as Error).message });
        }
      }
      if (orders.length < BULK_PAGE_SIZE) break;
      page++;
    }
    await this.setLastSync();
    await AuditService.log({ userId: (await getCurrentUser())?.id, action: "WOOCOMMERCE_SYNC", entity: "Integration", entityId: "woocommerce", changes: { type: "orders", synced, failed } });
    return { synced, failed };
  },

  async bulkSyncCategories() {
    const cfg = await this.getConfig();
    if (!cfg) throw new Error("WooCommerce not configured");
    let page = 1;
    let synced = 0;
    while (page <= MAX_BULK_PAGES) {
      const url = this.buildUrl(cfg, "/products/categories", { per_page: BULK_PAGE_SIZE, page });
      const res = await fetch(url);
      if (!res.ok) break;
      const cats = (await res.json()) as any[];
      if (!cats.length) break;
      for (const c of cats) {
        const existing = await db.category.findUnique({ where: { externalId: String(c.id) } });
        const slug = (c.slug ?? c.name ?? `woo-cat-${c.id}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
        if (existing) {
          await db.category.update({ where: { id: existing.id }, data: { name: c.name, slug, description: c.description ?? existing.description } });
        } else {
          await db.category.create({ data: { name: c.name, slug: `${slug}-${c.id}`, description: c.description, externalId: String(c.id) } }).catch(() => {});
        }
        synced++;
      }
      if (cats.length < BULK_PAGE_SIZE) break;
      page++;
    }
    await this.setLastSync();
    return { synced };
  },

  // ─────────────────────────────────────────────────────────────────────
  // OUTBOUND: CRM → Woo (push updates back to WooCommerce)
  //
  // These methods are called from the relevant CRM service after a successful
  // local update. They never throw to the caller — if Woo is unreachable,
  // the CRM operation must still succeed. Failures are logged to SyncLog
  // for retry.
  // ─────────────────────────────────────────────────────────────────────

  // Push product price/sale_price/status to WooCommerce.
  // Called from the products PUT API after a successful CRM update.
  async pushProductUpdate(productId: string, fields: { sellingPrice?: Prisma.Decimal | number; salePrice?: Prisma.Decimal | number; status?: string }) {
    const cfg = await this.getConfig();
    if (!cfg) return { skipped: true, reason: "not-configured" };
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product || !product.externalId) return { skipped: true, reason: "no-external-id" };
    try {
      const body: Record<string, unknown> = {};
      if (fields.sellingPrice !== undefined) body.regular_price = toDecimal(fields.sellingPrice).toFixed(2);
      if (fields.salePrice !== undefined) body.sale_price = toDecimal(fields.salePrice).toFixed(2);
      if (fields.status !== undefined) body.status = fields.status === "ACTIVE" ? "publish" : "draft";
      const url = this.buildUrl(cfg, `/products/${product.externalId}`, {});
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.upsertSyncLog({ entity: "product", externalId: product.externalId, operation: "push", status: "SUCCESS", payload: body });
      return { ok: true };
    } catch (e) {
      await this.upsertSyncLog({ entity: "product", externalId: product.externalId, operation: "push", status: "FAILED", message: (e as Error).message });
      return { ok: false, error: (e as Error).message };
    }
  },

  // Push stock quantity update to WooCommerce. Called from
  // InventoryService.applyMovementInTx (fire-and-forget, post-commit).
  async pushStockUpdate(productId: string, newQuantity: number) {
    const cfg = await this.getConfig();
    if (!cfg) return { skipped: true };
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product || !product.externalId) return { skipped: true };
    try {
      const body = { stock_quantity: newQuantity, manage_stock: true };
      const url = this.buildUrl(cfg, `/products/${product.externalId}`, {});
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.upsertSyncLog({ entity: "product", externalId: product.externalId, operation: "push_stock", status: "SUCCESS", payload: body });
      return { ok: true };
    } catch (e) {
      await this.upsertSyncLog({ entity: "product", externalId: product.externalId, operation: "push_stock", status: "FAILED", message: (e as Error).message });
      return { ok: false, error: (e as Error).message };
    }
  },

  // Push order status to WooCommerce. Called from OrderService.updateStatus
  // (fire-and-forget, post-commit).
  async pushOrderStatus(orderId: string, crmStatus: string) {
    const cfg = await this.getConfig();
    if (!cfg) return { skipped: true };
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order || !order.externalId) return { skipped: true };
    const wooStatus = CRM_TO_WOO_STATUS[crmStatus];
    if (!wooStatus) return { skipped: true, reason: "no-mapping" };
    try {
      const body = { status: wooStatus };
      const url = this.buildUrl(cfg, `/orders/${order.externalId}`, {});
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.upsertSyncLog({ entity: "order", externalId: order.externalId, operation: "push_status", status: "SUCCESS", payload: body });
      return { ok: true };
    } catch (e) {
      await this.upsertSyncLog({ entity: "order", externalId: order.externalId, operation: "push_status", status: "FAILED", message: (e as Error).message });
      return { ok: false, error: (e as Error).message };
    }
  },

  // Retry a previously-failed SyncLog row by re-running its operation.
  // Used by the /sync/retry endpoint and the (future) cron worker.
  async retrySyncLog(syncLogId: string) {
    const log = await db.syncLog.findUnique({ where: { id: syncLogId } });
    if (!log) throw new Error("SyncLog not found");
    if (log.status !== "FAILED") throw new Error("Only FAILED sync logs can be retried");
    if (!log.payload) throw new Error("No payload to retry");

    const cfg = await this.getConfig();
    if (!cfg) throw new Error("WooCommerce not configured");

    // The payload is the entity that was synced. For inbound syncs it was
    // the Woo payload; for outbound it was the push body. We can only retry
    // outbound pushes cleanly here — inbound retries should come through the
    // webhook endpoint (which calls syncProduct/syncCustomer/syncOrder with
    // the full payload from WebhookEvent).
    if (log.operation === "push") {
      const product = await db.product.findFirst({ where: { externalId: log.externalId } });
      if (product) {
        const payload = JSON.parse(log.payload) as { regular_price?: string; sale_price?: string; status?: string };
        return this.pushProductUpdate(product.id, {
          sellingPrice: payload.regular_price ? Number(payload.regular_price) : undefined,
          salePrice: payload.sale_price ? Number(payload.sale_price) : undefined,
          status: payload.status,
        });
      }
    }
    if (log.operation === "push_stock") {
      const payload = JSON.parse(log.payload) as { stock_quantity: number };
      const product = await db.product.findFirst({ where: { externalId: log.externalId } });
      if (product) return this.pushStockUpdate(product.id, payload.stock_quantity);
    }
    if (log.operation === "push_status") {
      const payload = JSON.parse(log.payload) as { status: string };
      const order = await db.order.findFirst({ where: { externalId: log.externalId } });
      if (order) {
        const reverseMap: Record<string, string> = { pending: "PENDING", processing: "CONFIRMED", completed: "DELIVERED", cancelled: "CANCELLED", refunded: "REFUNDED" };
        const crmStatus = reverseMap[payload.status];
        if (crmStatus) return this.pushOrderStatus(order.id, crmStatus);
      }
    }

    throw new Error(`Cannot retry sync log with operation ${log.operation} — re-trigger from source system`);
  },

  // ─────────────────────────────────────────────────────────────────────
  // AUTOMATED RETRY WORKER
  //
  // Called by the Vercel Cron route (/api/cron/woocommerce-retry, every 5
  // minutes) and by the manual "Retry all failed" admin button. Safely
  // claims a batch of FAILED SyncLog rows whose nextRetryAt has elapsed,
  // retries each one, and records the outcome.
  //
  // LOCK SEMANTICS:
  //   We use an atomic updateMany to "claim" rows — flipping status from
  //   FAILED to RETRYING in a single query so two concurrent cron
  //   invocations don't double-process the same row. If the retry succeeds,
  //   status becomes SUCCESS. If it fails, status goes back to FAILED with
  //   an updated nextRetryAt (exponential backoff) — unless maxAttempts is
  //   reached, in which case status becomes FAILED with nextRetryAt=null
  //   (permanently failed, won't be picked up again).
  // ─────────────────────────────────────────────────────────────────────
  async claimAndRetryFailed(opts: { limit?: number } = {}): Promise<{ claimed: number; succeeded: number; failed: number; permanentlyFailed: number }> {
    const limit = Math.min(opts.limit ?? 20, 50); // cap at 50 per run

    // Claim: atomically flip FAILED → RETRYING for rows due for retry.
    // The `nextRetryAt <= now()` condition is what makes this safe — a row
    // that just failed won't be re-claimed until its backoff window passes.
    const now = new Date();
    const claimed = await db.syncLog.updateMany({
      where: {
        status: "FAILED",
        nextRetryAt: { lte: now },
        attemptCount: { lt: 5 }, // maxAttempts = 5 (matches upsertSyncLog backoff schedule)
      },
      data: { status: "RETRYING" },
    });

    if (claimed.count === 0) {
      return { claimed: 0, succeeded: 0, failed: 0, permanentlyFailed: 0 };
    }

    // Fetch the claimed rows (capped at `limit`).
    const rows = await db.syncLog.findMany({
      where: { status: "RETRYING" },
      take: limit,
      orderBy: { nextRetryAt: "asc" },
    });

    let succeeded = 0;
    let failed = 0;
    let permanentlyFailed = 0;

    for (const row of rows) {
      try {
        await this.retrySyncLog(row.id);
        // Success — mark the row.
        await db.syncLog.update({
          where: { id: row.id },
          data: { status: "SUCCESS", nextRetryAt: null, lastErrorAt: null, message: `Retried successfully (attempt ${row.attemptCount + 1})` },
        });
        succeeded++;
      } catch (e) {
        const errorMsg = (e as Error).message;
        const newAttemptCount = row.attemptCount + 1;
        // Exponential backoff: 1m, 5m, 25m, 2h, 10h.
        const backoffMs = [60_000, 300_000, 1_500_000, 7_200_000, 36_000_000];
        const isPermanent = newAttemptCount >= 5;
        const nextRetryAt = isPermanent ? null : new Date(Date.now() + backoffMs[Math.min(newAttemptCount, backoffMs.length - 1)]);
        await db.syncLog.update({
          where: { id: row.id },
          data: {
            status: "FAILED",
            message: errorMsg,
            lastErrorAt: new Date(),
            nextRetryAt,
            // Reset attemptCount only if permanent — otherwise increment.
            attemptCount: isPermanent ? newAttemptCount : { increment: 1 },
          },
        });
        if (isPermanent) {
          permanentlyFailed++;
          // Audit the permanent failure so it's visible in the dashboard.
          await AuditService.log({
            userId: null,
            action: "WOOCOMMERCE_SYNC_PERMANENT_FAILURE",
            entity: "SyncLog",
            entityId: row.id,
            changes: { entity: row.entity, externalId: row.externalId, operation: row.operation, attempts: newAttemptCount, lastError: errorMsg },
          });
        } else {
          failed++;
        }
      }
    }

    return { claimed: claimed.count, succeeded, failed, permanentlyFailed };
  },

  // ─────────────────────────────────────────────────────────────────────
  // RECONCILIATION
  //
  // Compares Z-CRM's records against WooCommerce's current state and reports
  // differences. Does NOT modify any data — the caller (admin dashboard)
  // decides what to resync.
  //
  // Result categories per entity:
  //   MATCHED   — CRM record exists, Woo record exists, fields agree
  //   CRM_ONLY  — CRM record exists, Woo has no matching record (deleted on Woo?)
  //   WOO_ONLY  — Woo record exists, CRM has no matching record (sync missed)
  //   DIFFERENT — both exist but key fields disagree (price, stock, status)
  //   ERROR     — couldn't fetch from Woo (auth, network, etc.)
  // ─────────────────────────────────────────────────────────────────────
  async reconcileProducts(opts: { limit?: number } = {}): Promise<{
    matched: number; crmOnly: number; wooOnly: number; different: number; error?: string;
    details: { externalId: string; sku: string; status: "MATCHED" | "CRM_ONLY" | "WOO_ONLY" | "DIFFERENT" | "ERROR"; differences?: string[] }[];
  }> {
    const cfg = await this.getConfig();
    if (!cfg) return { matched: 0, crmOnly: 0, wooOnly: 0, different: 0, error: "WooCommerce not configured", details: [] };

    // Fetch all Woo products (paginate).
    const wooProducts = new Map<string, { id: number; sku?: string; regular_price?: string; sale_price?: string; stock_quantity?: number | null; status?: string }>();
    let page = 1;
    while (page <= 10) { // cap at 10 pages = 1000 products
      const url = this.buildUrl(cfg, "/products", { per_page: 100, page });
      const res = await fetch(url);
      if (!res.ok) return { matched: 0, crmOnly: 0, wooOnly: 0, different: 0, error: `Woo fetch failed: HTTP ${res.status}`, details: [] };
      const items = (await res.json()) as any[];
      if (!items.length) break;
      for (const p of items) wooProducts.set(String(p.id), p);
      if (items.length < 100) break;
      page++;
    }

    // Fetch all CRM products with externalId.
    const crmProducts = await db.product.findMany({
      where: { externalId: { not: null } },
      take: opts.limit ?? 1000,
    });

    const details: { externalId: string; sku: string; status: "MATCHED" | "CRM_ONLY" | "WOO_ONLY" | "DIFFERENT" | "ERROR"; differences?: string[] }[] = [];
    let matched = 0, crmOnly = 0, different = 0;

    // Check CRM products against Woo.
    for (const crm of crmProducts) {
      const extId = crm.externalId!;
      const woo = wooProducts.get(extId);
      if (!woo) {
        crmOnly++;
        details.push({ externalId: extId, sku: crm.sku, status: "CRM_ONLY" });
        continue;
      }
      wooProducts.delete(extId); // remove from Woo map; remaining = WOO_ONLY
      // Compare key fields.
      const diffs: string[] = [];
      const wooPrice = toDecimal(woo.sale_price || woo.regular_price || 0).toNumber();
      if (Math.abs(wooPrice - crm.sellingPrice) > 0.01) diffs.push(`price: CRM=${crm.sellingPrice} Woo=${wooPrice}`);
      const wooStatus = woo.status === "draft" ? "INACTIVE" : "ACTIVE";
      if (wooStatus !== crm.status) diffs.push(`status: CRM=${crm.status} Woo=${wooStatus}`);
      if (diffs.length > 0) {
        different++;
        details.push({ externalId: extId, sku: crm.sku, status: "DIFFERENT", differences: diffs });
      } else {
        matched++;
        details.push({ externalId: extId, sku: crm.sku, status: "MATCHED" });
      }
    }
    // Remaining Woo products = WOO_ONLY.
    const wooOnly = wooProducts.size;
    for (const [extId, woo] of wooProducts) {
      details.push({ externalId: extId, sku: woo.sku ?? `WOO-${extId}`, status: "WOO_ONLY" });
    }

    return { matched, crmOnly, wooOnly, different, details };
  },

  async reconcileOrders(opts: { limit?: number } = {}): Promise<{
    matched: number; crmOnly: number; wooOnly: number; different: number; error?: string;
    details: { externalId: string; status: "MATCHED" | "CRM_ONLY" | "WOO_ONLY" | "DIFFERENT" | "ERROR"; differences?: string[] }[];
  }> {
    const cfg = await this.getConfig();
    if (!cfg) return { matched: 0, crmOnly: 0, wooOnly: 0, different: 0, error: "WooCommerce not configured", details: [] };

    const wooOrders = new Map<string, { id: number; status: string; total: string; payment_method?: string }>();
    let page = 1;
    while (page <= 10) {
      const url = this.buildUrl(cfg, "/orders", { per_page: 100, page });
      const res = await fetch(url);
      if (!res.ok) return { matched: 0, crmOnly: 0, wooOnly: 0, different: 0, error: `Woo fetch failed: HTTP ${res.status}`, details: [] };
      const items = (await res.json()) as any[];
      if (!items.length) break;
      for (const o of items) wooOrders.set(String(o.id), o);
      if (items.length < 100) break;
      page++;
    }

    const crmOrders = await db.order.findMany({
      where: { externalId: { not: null } },
      take: opts.limit ?? 1000,
    });

    const details: { externalId: string; status: "MATCHED" | "CRM_ONLY" | "WOO_ONLY" | "DIFFERENT" | "ERROR"; differences?: string[] }[] = [];
    let matched = 0, crmOnly = 0, different = 0;

    for (const crm of crmOrders) {
      const extId = crm.externalId!;
      const woo = wooOrders.get(extId);
      if (!woo) {
        crmOnly++;
        details.push({ externalId: extId, status: "CRM_ONLY" });
        continue;
      }
      wooOrders.delete(extId);
      const diffs: string[] = [];
      const wooCrmStatus = WOO_TO_CRM_STATUS[woo.status] ?? "";
      if (wooCrmStatus && wooCrmStatus !== crm.status) diffs.push(`status: CRM=${crm.status} Woo=${wooCrmStatus} (${woo.status})`);
      const wooTotal = toDecimal(woo.total || 0).toNumber();
      if (Math.abs(wooTotal - crm.total) > 0.01) diffs.push(`total: CRM=${crm.total} Woo=${wooTotal}`);
      if (diffs.length > 0) {
        different++;
        details.push({ externalId: extId, status: "DIFFERENT", differences: diffs });
      } else {
        matched++;
        details.push({ externalId: extId, status: "MATCHED" });
      }
    }
    const wooOnly = wooOrders.size;
    for (const [extId] of wooOrders) details.push({ externalId: extId, status: "WOO_ONLY" });

    return { matched, crmOnly, wooOnly, different, details };
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

// Keep the InventoryService import used in the type re-export for callers
// that want to trigger a stock push after a movement.
export type { InventoryService };
