// @ts-nocheck
// MongoDB seed — uses Float fields. Decimal→number conversion handled by Prisma runtime.
// Seed script: creates roles, permissions, all 6 system users, channels,
// expense categories, 10+ products, 10+ customers, suppliers, 10+ purchases,
// 20+ orders, payments, expenses, returns. Realistic Bangladesh business data.

import { PrismaClient, Prisma } from "@prisma/client";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "../src/lib/constants";
import { hashPassword } from "../src/lib/auth";

const db = new PrismaClient();

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("Seeding Z-CRM...");

  // --- Roles & permissions ---
  for (const name of ROLES) {
    await db.role.upsert({
      where: { name },
      create: { name, isSystem: true, description: `System role: ${name}`, permissionActions: ROLE_PERMISSIONS[name as (typeof ROLES)[number]] },
      update: { isSystem: true, permissionActions: ROLE_PERMISSIONS[name as (typeof ROLES)[number]] },
    });
  }
  // Permissions (lookup table — no longer M2M with roles)
  for (const action of PERMISSIONS) {
    await db.permission.upsert({ where: { action }, create: { action }, update: {} });
  }

  // --- Channels ---
  const channelNames = ["Website", "Facebook", "Messenger", "WhatsApp", "Instagram", "Phone", "Physical Store", "Other"];
  for (const n of channelNames) {
    await db.channel.upsert({ where: { name: n }, create: { name: n, isSystem: true }, update: {} });
  }

  // --- Warehouses (default + a secondary) ---
  await db.warehouse.upsert({ where: { code: "MAIN" }, create: { name: "Main Warehouse", code: "MAIN", isDefault: true, isActive: true }, update: {} });
  await db.warehouse.upsert({ where: { code: "SEC" }, create: { name: "Secondary Store", code: "SEC", isDefault: false, isActive: true, address: "Karwan Bazar, Dhaka" }, update: {} });

  // --- Expense categories ---
  const expCats = ["Delivery", "Packaging", "Marketing", "Salary", "Rent", "Utility", "Office", "Transport", "Other"];
  for (const n of expCats) {
    await db.expenseCategory.upsert({ where: { name: n }, create: { name: n, isSystem: true }, update: {} });
  }

  // --- Users ---
  const websiteChannel = (await db.channel.findFirst({ where: { name: "Website" } }))!;
  const usersData = [
    { name: "Super Admin", email: "superadmin@zcrm.local", role: "SUPER_ADMIN", password: "Admin@123" },
    { name: "Business Admin", email: "admin@zcrm.local", role: "ADMIN", password: "Admin@123" },
    { name: "Store Manager", email: "manager@zcrm.local", role: "MANAGER", password: "Manager@123" },
    { name: "Sales Officer", email: "sales@zcrm.local", role: "SALES", password: "Sales@123" },
    { name: "Inventory Officer", email: "inventory@zcrm.local", role: "INVENTORY", password: "Stock@123" },
    { name: "Accountant", email: "accounts@zcrm.local", role: "ACCOUNTANT", password: "Accts@123" },
  ];
  const userMap: Record<string, string> = {};
  for (const u of usersData) {
    const role = await db.role.findUnique({ where: { name: u.role } });
    const passwordHash = await hashPassword(u.password);
    const created = await db.user.upsert({
      where: { email: u.email },
      create: { name: u.name, email: u.email, passwordHash, roleId: role!.id, isActive: true },
      update: { name: u.name, roleId: role!.id, passwordHash, isActive: true },
    });
    userMap[u.role] = created.id;
  }

  // --- Categories ---
  const catData = [
    { name: "Electronics", slug: "electronics", sortOrder: 1 },
    { name: "Mobile Accessories", slug: "mobile-accessories", sortOrder: 2 },
    { name: "Home Appliances", slug: "home-appliances", sortOrder: 3 },
    { name: "Audio", slug: "audio", sortOrder: 4 },
    { name: "Computing", slug: "computing", sortOrder: 5 },
    { name: "Cables & Chargers", slug: "cables-chargers", sortOrder: 6 },
    { name: "Office Supplies", slug: "office-supplies", sortOrder: 7 },
    { name: "Stationery", slug: "stationery", sortOrder: 8 },
  ];
  const catMap: Record<string, string> = {};
  for (const c of catData) {
    const created = await db.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: {},
    });
    catMap[c.name] = created.id;
  }

  // --- Suppliers ---
  const supplierData = [
    { name: "TechTrade Bangladesh", phone: "01711000001", email: "sales@techtrade.com", company: "TechTrade BD", address: "Elezbi Business Hub, Mirpur 10, Dhaka" },
    { name: "GadgetHub Importers", phone: "01711000002", email: "info@gadgethub.com", company: "GadgetHub", address: "Nawabpur, Dhaka" },
    { name: "SmartLife Distributors", phone: "01711000003", email: "contact@smartlife.com", company: "SmartLife", address: "Karwan Bazar, Dhaka" },
    { name: "Eastern Electronics", phone: "01711000004", email: "orders@easternelec.com", company: "Eastern Electronics", address: "Chittagong" },
    { name: "Pacific Office Supplies", phone: "01711000005", email: "sales@pacificoffice.com", company: "Pacific Office", address: "Motijheel, Dhaka" },
  ];
  const supplierIds: string[] = [];
  for (const s of supplierData) {
    const created = await db.supplier.create({ data: s });
    supplierIds.push(created.id);
  }

  // --- Products (10+) ---
  const productData = [
    { sku: "EAR-001", name: "Wireless Earbuds Pro", categoryId: "Electronics", brand: "SoundMax", purchasePrice: 850, sellingPrice: 1490, wholesalePrice: 1250, minimumStockLevel: 20 },
    { sku: "CHG-002", name: "65W USB-C Fast Charger", categoryId: "Mobile Accessories", brand: "VoltPro", purchasePrice: 380, sellingPrice: 750, wholesalePrice: 600, minimumStockLevel: 30 },
    { sku: "CAB-003", name: "Braided USB-C Cable 1m", categoryId: "Cables & Chargers", brand: "DuraCord", purchasePrice: 90, sellingPrice: 220, wholesalePrice: 160, minimumStockLevel: 50 },
    { sku: "SPK-004", name: "Bluetooth Mini Speaker", categoryId: "Audio", brand: "LoudBox", purchasePrice: 620, sellingPrice: 1180, wholesalePrice: 950, minimumStockLevel: 15 },
    { sku: "MSE-005", name: "Wireless Mouse 2.4GHz", categoryId: "Computing", brand: "ClickPro", purchasePrice: 240, sellingPrice: 490, wholesalePrice: 380, minimumStockLevel: 25 },
    { sku: "KBD-006", name: "Mechanical Keyboard RGB", categoryId: "Computing", brand: "KeyMaster", purchasePrice: 1450, sellingPrice: 2890, wholesalePrice: 2400, minimumStockLevel: 10 },
    { sku: "PWB-007", name: "20000mAh Power Bank", categoryId: "Mobile Accessories", brand: "VoltPro", purchasePrice: 780, sellingPrice: 1490, wholesalePrice: 1200, minimumStockLevel: 20 },
    { sku: "FAN-008", name: "USB Desk Fan 6 inch", categoryId: "Home Appliances", brand: "CoolBreeze", purchasePrice: 420, sellingPrice: 790, wholesalePrice: 650, minimumStockLevel: 15 },
    { sku: "LMP-009", name: "LED Desk Lamp Touch", categoryId: "Home Appliances", brand: "BrightHome", purchasePrice: 510, sellingPrice: 980, wholesalePrice: 800, minimumStockLevel: 12 },
    { sku: "NOT-010", name: "A4 Notebook 200 Pages", categoryId: "Stationery", brand: "WriteWell", purchasePrice: 70, sellingPrice: 160, wholesalePrice: 110, minimumStockLevel: 100 },
    { sku: "PEN-011", name: "Ballpoint Pen Set (10)", categoryId: "Office Supplies", brand: "WriteWell", purchasePrice: 45, sellingPrice: 120, wholesalePrice: 85, minimumStockLevel: 100 },
    { sku: "HDP-012", name: "Over-Ear Headphones", categoryId: "Audio", brand: "SoundMax", purchasePrice: 980, sellingPrice: 1890, wholesalePrice: 1550, minimumStockLevel: 10 },
  ];
  const productMap: Record<string, string> = {};
  for (const p of productData) {
    const created = await db.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        slug: `${p.sku.toLowerCase()}`,
        categoryId: catMap[p.categoryId],
        brand: p.brand,
        purchasePrice: new Prisma.Decimal(p.purchasePrice),
        sellingPrice: new Prisma.Decimal(p.sellingPrice),
        wholesalePrice: new Prisma.Decimal(p.wholesalePrice),
        minimumStockLevel: new Prisma.Decimal(p.minimumStockLevel),
        status: "ACTIVE",
      },
    });
    productMap[p.sku] = created.id;
    // seed initial inventory via stock movement (PURCHASE)
    const initQty = Math.floor(Math.random() * 60) + p.minimumStockLevel;
    const inventory = await db.inventory.upsert({
      where: { productId: created.id },
      create: { productId: created.id, quantity: new Prisma.Decimal(initQty), damagedQuantity: new Prisma.Decimal(0) },
      update: { quantity: new Prisma.Decimal(initQty) },
    });
    await db.stockMovement.create({
      data: {
        productId: created.id,
        type: "PURCHASE",
        quantityChange: new Prisma.Decimal(initQty),
        previousQuantity: new Prisma.Decimal(0),
        newQuantity: inventory.quantity,
        referenceType: "MANUAL",
        reason: "Initial stock on seed",
        createdBy: userMap.INVENTORY,
      },
    });
  }

  // --- Purchases (10+) ---
  for (let i = 0; i < 12; i++) {
    const supplierId = pick(supplierIds);
    const items = Array.from({ length: Math.floor(Math.random() * 3) + 1 }).map(() => {
      const p = pick(productData);
      return { productId: productMap[p.sku], quantity: new Prisma.Decimal(Math.floor(Math.random() * 50) + 10), unitCost: new Prisma.Decimal(p.purchasePrice) };
    });
    const subtotal = items.reduce((s, it) => s.plus(it.quantity.times(it.unitCost)), new Prisma.Decimal(0));
    const discount = new Prisma.Decimal(Math.floor(Math.random() * 200));
    const shippingCost = new Prisma.Decimal(pick([0, 50, 80, 120]));
    const total = subtotal.minus(discount).plus(shippingCost);
    const paid = Math.random() > 0.3 ? total : total.times(0.5);
    const due = total.minus(paid);
    const purchaseNumber = `PUR-${String(i + 1001).padStart(6, "0")}`;
    const purchase = await db.purchase.create({
      data: {
        purchaseNumber,
        supplierId,
        status: "RECEIVED",
        subtotal,
        discount,
        shippingCost,
        total,
        paidAmount: paid,
        dueAmount: due,
        paymentStatus: paid.gte(total) ? "PAID" : "PARTIAL",
        notes: "Seeded purchase",
        createdBy: userMap.INVENTORY,
        items: { create: items.map((it) => ({ productId: it.productId, quantity: it.quantity, unitCost: it.unitCost, total: it.quantity.times(it.unitCost) })) },
      },
    });
    // apply stock movement (we already seeded initial stock, but reflect this purchase too on some)
    if (Math.random() > 0.5) {
      for (const it of items) {
        const inv = await db.inventory.findUnique({ where: { productId: it.productId } });
        const prev = new Prisma.Decimal(inv?.quantity ?? 0);
        await db.inventory.update({
          where: { productId: it.productId },
          data: { quantity: prev.plus(it.quantity) },
        });
        await db.stockMovement.create({
          data: {
            productId: it.productId,
            type: "PURCHASE",
            quantityChange: it.quantity,
            previousQuantity: prev,
            newQuantity: prev.plus(it.quantity),
            referenceType: "PURCHASE",
            referenceId: purchase.id,
            reason: `Purchase ${purchaseNumber}`,
            createdBy: userMap.INVENTORY,
          },
        });
      }
    }
  }

  // --- Customers (10+) ---
  const customerData = [
    { name: "Rahim Ahmed", phone: "01711234501", email: "rahim@example.com", address: "House 12, Road 3, Banani", city: "Dhaka" },
    { name: "Karim Hassan", phone: "01711234502", email: "karim@example.com", address: "Flat B2, Gulshan 2", city: "Dhaka" },
    { name: "Fatima Begum", phone: "01711234503", email: "fatima@example.com", address: "Mirpur 10", city: "Dhaka" },
    { name: "Tanvir Rahman", phone: "01711234504", email: "tanvir@example.com", address: "Uttara Sector 7", city: "Dhaka" },
    { name: "Sadia Islam", phone: "01711234505", email: "sadia@example.com", address: "Dhanmondi 27", city: "Dhaka" },
    { name: "Nayeem Chowdhury", phone: "01711234506", email: "nayeem@example.com", address: "Mohammadpur", city: "Dhaka" },
    { name: "Ayesha Siddique", phone: "01711234507", email: "ayesha@example.com", address: "Banashree", city: "Dhaka" },
    { name: "Imran Khan", phone: "01711234508", email: "imran@example.com", address: "Chittagong GEC", city: "Chittagong" },
    { name: "Sabbir Hossain", phone: "01711234509", email: "sabbir@example.com", address: "Sylhet Zindabazar", city: "Sylhet" },
    { name: "Mahbub Alam", phone: "01711234510", email: "mahbub@example.com", address: "Khulna Boyra", city: "Khulna" },
    { name: "Rumana Akter", phone: "01711234511", email: "rumana@example.com", address: "Rajshahi", city: "Rajshahi" },
    { name: "Jahid Hasan", phone: "01711234512", email: "jahid@example.com", address: "Bashundhara R/A", city: "Dhaka" },
  ];
  const customerIds: string[] = [];
  for (const c of customerData) {
    const created = await db.customer.create({ data: c });
    customerIds.push(created.id);
  }

  // --- Orders (20+) ---
  const orderChannels = ["Website", "Facebook", "WhatsApp", "Phone", "Physical Store", "Messenger"];
  const statuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
  const methods = ["CASH", "BKASH", "NAGAD", "BANK", "CARD"];
  for (let i = 0; i < 22; i++) {
    const customerId = pick(customerIds);
    const channelName = pick(orderChannels);
    const channel = (await db.channel.findFirst({ where: { name: channelName } }))!;
    const numItems = Math.floor(Math.random() * 3) + 1;
    const items = Array.from({ length: numItems }).map(() => {
      const p = pick(productData);
      return { productId: productMap[p.sku], quantity: new Prisma.Decimal(Math.floor(Math.random() * 3) + 1), p };
    });
    const subtotal = items.reduce((s, it) => s.plus(it.quantity.times(new Prisma.Decimal(it.p.sellingPrice))), new Prisma.Decimal(0));
    const discount = new Prisma.Decimal(Math.random() > 0.7 ? Math.floor(Math.random() * 100) : 0);
    const shippingCost = new Prisma.Decimal(pick([0, 60, 80, 100, 120]));
    const otherCost = new Prisma.Decimal(0);
    const total = subtotal.minus(discount).plus(shippingCost).plus(otherCost);
    const status = pick(statuses);
    const daysAgo = Math.floor(Math.random() * 40);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    const createdBy = Math.random() > 0.5 ? userMap.SALES : userMap.MANAGER;
    const orderNumber = `ORD-${String(i + 1001).padStart(6, "0")}`;

    const order = await db.order.create({
      data: {
        orderNumber,
        customerId,
        channelId: channel.id,
        status,
        paymentStatus: "UNPAID",
        subtotal,
        discount,
        shippingCost,
        otherCost,
        total,
        paidAmount: new Prisma.Decimal(0),
        syncStatus: "LOCAL",
        sourceChannel: channelName,
        notes: "Seeded order",
        createdBy,
        createdAt,
        items: {
          create: items.map((it) => ({
            productId: it.productId,
            productName: it.p.name,
            sku: it.p.sku,
            quantity: it.quantity,
            unitPrice: new Prisma.Decimal(it.p.sellingPrice),
            unitCost: new Prisma.Decimal(it.p.purchasePrice),
            discount: new Prisma.Decimal(0),
            total: it.quantity.times(new Prisma.Decimal(it.p.sellingPrice)),
          })),
        },
        statusHistory: { create: { status, note: "Seeded", createdBy } },
      },
    });

    // decrement stock for non-cancelled orders
    if (status !== "CANCELLED") {
      for (const it of items) {
        const inv = await db.inventory.findUnique({ where: { productId: it.productId } });
        const prev = new Prisma.Decimal(inv?.quantity ?? 0);
        if (prev.gte(it.quantity)) {
          await db.inventory.update({
            where: { productId: it.productId },
            data: { quantity: prev.minus(it.quantity) },
          });
          await db.stockMovement.create({
            data: {
              productId: it.productId,
              type: "SALE",
              quantityChange: it.quantity.negated(),
              previousQuantity: prev,
              newQuantity: prev.minus(it.quantity),
              referenceType: "ORDER",
              referenceId: order.id,
              reason: `Order ${orderNumber}`,
              createdBy,
            },
          });
        }
      }
    }

    // Payments (full or partial)
    const method = pick(methods);
    if (status !== "CANCELLED") {
      const fullPay = Math.random() > 0.3;
      const amt = fullPay ? total : total.times(0.5);
      const pmt = await db.payment.create({
        data: {
          orderId: order.id,
          customerId,
          amount: amt,
          method,
          transactionReference: `SEED-${i}`,
          createdBy,
          createdAt,
        },
      });
      const paid = amt;
      let paymentStatus = "PARTIAL";
      if (paid.gte(total)) paymentStatus = "PAID";
      await db.order.update({ where: { id: order.id }, data: { paidAmount: paid, paymentStatus } });
    }
  }

  // --- Expenses (10+) ---
  const allCats = await db.expenseCategory.findMany();
  for (let i = 0; i < 12; i++) {
    const cat = pick(allCats);
    const amount = new Prisma.Decimal(pick([300, 500, 800, 1200, 2500, 5000, 8000, 15000]));
    const daysAgo = Math.floor(Math.random() * 40);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    await db.expense.create({
      data: {
        categoryId: cat.id,
        amount,
        paymentMethod: pick(methods),
        description: `Seeded expense — ${cat.name}`,
        reference: `EXP-${i + 1}`,
        expenseDate: date,
        createdBy: userMap.ACCOUNTANT,
      },
    });
  }

  // --- Settings ---
  await db.setting.upsert({
    where: { key: "currency" },
    create: { key: "currency", value: "BDT" },
    update: {},
  });
  await db.setting.upsert({
    where: { key: "currencySymbol" },
    create: { key: "currencySymbol", value: "৳" },
    update: {},
  });
  await db.setting.upsert({
    where: { key: "allowNegativeStock" },
    create: { key: "allowNegativeStock", value: "false" },
    update: {},
  });
  await db.setting.upsert({
    where: { key: "businessName" },
    create: { key: "businessName", value: "Z-CRM Demo Store" },
    update: {},
  });

  // --- Integration (dev config with non-empty webhook secret) ---
  // SECURITY: the webhook secret is seeded with a non-empty dev value so the
  // WooCommerce webhook receiver rejects unsigned POSTs by default. The
  // operator MUST replace this with a real secret when configuring a live
  // WooCommerce store.
  await db.integration.upsert({
    where: { name: "woocommerce" },
    create: {
      name: "woocommerce",
      config: JSON.stringify({
        url: "",
        consumerKey: "",
        consumerSecret: "",
        webhookSecret: "zcrm_woo_dev_webhook_secret_at_least_32_chars",
      }),
      status: "DISCONNECTED",
    },
    update: {},
  });

  // --- Meta & WhatsApp connections (placeholders — no real tokens) ---
  // appSecret is populated with a known dev value so the webhook HMAC
  // signature verification can be tested. Operators MUST replace these
  // with real Meta App Secrets before going live.
  const metaConn = await db.metaConnection.create({
    data: {
      name: "Main Facebook Page",
      facebookPageId: "100000000001",
      facebookPageName: "Z-CRM Demo Store",
      instagramBusinessId: "1789000000001",
      instagramUsername: "zcrm_demo",
      accessToken: "PLACEHOLDER_TOKEN_REPLACE_WITH_REAL_META_TOKEN",
      appSecret: "zcrm_meta_dev_app_secret_at_least_32_chars_padding",
      appId: "900000000000001",
      webhookVerifyToken: "zcrm_meta_verify_token",
      connectedUserId: "100000000001",
      status: "CONNECTED",
      createdBy: userMap.ADMIN,
    },
  });

  const waConn = await db.whatsAppConnection.create({
    data: {
      name: "Sales WhatsApp",
      phoneNumberId: "100000000000001",
      phoneNumber: "+8801700000001",
      businessAccountId: "200000000000001",
      wabaId: "300000000000001",
      accessToken: "PLACEHOLDER_TOKEN_REPLACE_WITH_REAL_WHATSAPP_TOKEN",
      appSecret: "zcrm_wa_dev_app_secret_at_least_32_chars_padding",
      webhookVerifyToken: "zcrm_wa_verify_token",
      status: "CONNECTED",
      createdBy: userMap.ADMIN,
    },
  });

  // --- Message templates ---
  const templates = [
    { name: "order_received", channel: "whatsapp", category: "TRANSACTIONAL", language: "en", body: "Hi {{customer_name}}, we've received your order {{order_number}} for {{order_total}}. We'll confirm shortly. — {{business_name}}", isApproved: true, status: "ACTIVE" },
    { name: "order_confirmed", channel: "whatsapp", category: "TRANSACTIONAL", language: "en", body: "Hello {{customer_name}}, your order {{order_number}} is confirmed. We're preparing it now. — {{business_name}}", isApproved: true, status: "ACTIVE" },
    { name: "order_shipped", channel: "whatsapp", category: "TRANSACTIONAL", language: "en", body: "Good news {{customer_name}}! Order {{order_number}} has been shipped. Tracking: {{tracking_number}} — {{business_name}}", isApproved: true, status: "ACTIVE" },
    { name: "order_delivered", channel: "whatsapp", category: "TRANSACTIONAL", language: "en", body: "Hi {{customer_name}}, order {{order_number}} has been delivered. Thank you for shopping with {{business_name}}!", isApproved: true, status: "ACTIVE" },
    { name: "payment_received", channel: "whatsapp", category: "TRANSACTIONAL", language: "en", body: "We received your payment for order {{order_number}} ({{order_total}}). Payment status: {{payment_status}}. — {{business_name}}", isApproved: true, status: "ACTIVE" },
    { name: "payment_pending", channel: "whatsapp", category: "TRANSACTIONAL", language: "en", body: "Reminder: order {{order_number}} has a pending payment of {{order_total}}. — {{business_name}}", isApproved: true, status: "ACTIVE" },
    { name: "order_cancelled", channel: "whatsapp", category: "TRANSACTIONAL", language: "en", body: "Hi {{customer_name}}, order {{order_number}} has been cancelled. — {{business_name}}", isApproved: true, status: "ACTIVE" },
    { name: "welcome_message", channel: "whatsapp", category: "UTILITY", language: "en", body: "Welcome to {{business_name}}, {{customer_name}}! How can we help you today?", isApproved: true, status: "ACTIVE" },
    { name: "messenger_welcome", channel: "messenger", category: "UTILITY", language: "en", body: "Hi {{customer_name}}! Thanks for messaging {{business_name}}. Our team will respond shortly.", isApproved: true, status: "ACTIVE" },
  ];
  for (const t of templates) {
    const existing = await db.messageTemplate.findUnique({ where: { name: t.name } });
    if (!existing) await db.messageTemplate.create({ data: t });
  }

  // --- Conversations + messages (WhatsApp + Facebook) ---
  const waChannel = await db.channel.findFirst({ where: { name: "WhatsApp" } });
  const fbChannel = await db.channel.findFirst({ where: { name: "Facebook" } });
  const sampleConvs = [
    { provider: "whatsapp", externalConversationId: "8801711234501", contactName: "Rahim Ahmed", contactPhone: "01711234501", channelId: waChannel?.id, customerId: customerIds[0] },
    { provider: "whatsapp", externalConversationId: "8801711234502", contactName: "Karim Hassan", contactPhone: "01711234502", channelId: waChannel?.id, customerId: customerIds[1] },
    { provider: "facebook", externalConversationId: "100000000002", contactName: "Sadia Islam", contactPhone: "01711234505", channelId: fbChannel?.id, customerId: customerIds[4] },
    { provider: "whatsapp", externalConversationId: "8801711234508", contactName: "Imran Khan", contactPhone: "01711234508", channelId: waChannel?.id, customerId: customerIds[7] },
  ];
  for (const c of sampleConvs) {
    const conv = await db.conversation.create({
      data: {
        provider: c.provider,
        externalConversationId: c.externalConversationId,
        providerConnectionId: c.provider === "whatsapp" ? waConn.id : metaConn.id,
        contactName: c.contactName,
        contactPhone: c.contactPhone,
        channelId: c.channelId ?? null,
        customerId: c.customerId,
        status: pick(["OPEN", "PENDING", "RESOLVED", "CLOSED"]),
        unreadCount: Math.floor(Math.random() * 3),
        lastMessageAt: new Date(),
        lastMessagePreview: pick(["Hi, do you have this in stock?", "I want to order 2 units", "Can I pay via bKash?", "Where is my order?", "Thank you!"]),
      },
    });
    // 3-5 messages per conversation
    const msgCount = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < msgCount; i++) {
      const incoming = Math.random() > 0.5;
      await db.message.create({
        data: {
          conversationId: conv.id,
          direction: incoming ? "INCOMING" : "OUTGOING",
          provider: c.provider,
          body: pick([
            "Hi, do you have Wireless Earbuds Pro in stock?",
            "Yes, it's available for ৳1,490. Would you like to order?",
            "I'll take 2 units",
            "Great! Let me create an order for you",
            "Can I pay via bKash?",
            "Yes, our bKash number is 01711-000000",
            "Thank you!",
            "You're welcome! Your order is confirmed.",
          ]),
          status: "DELIVERED",
          sentBy: incoming ? null : userMap.SALES,
          createdAt: new Date(Date.now() - (msgCount - i) * 600000),
        },
      });
    }
  }

  // --- Meta leads ---
  for (let i = 0; i < 5; i++) {
    const phone = `0171123450${20 + i}`;
    await db.metaLead.create({
      data: {
        connectionId: metaConn.id,
        externalLeadId: `leadgen_seed_${i}`,
        name: pick(["Biplob Saha", "Nusrat Jahan", "Rakibul Islam", "Mitu Akter", "Shanto Rahman"]),
        phone,
        email: `lead${i}@example.com`,
        source: "Meta Lead Ad",
        campaign: "Summer Electronics",
        ad: `ad_${i + 1}`,
        form: "Lead Form v1",
        status: "NEW",
        payload: JSON.stringify({ field_data: [{ name: "full_name", values: [] }, { name: "phone_number", values: [phone] }] }),
      },
    });
  }

  // --- WebhookEvent log sample (so the Logs page isn't empty) ---
  await db.webhookEvent.create({
    data: { provider: "whatsapp", eventId: "wamid.sample.001", eventType: "message", status: "SUCCESS", processedAt: new Date() },
  });
  await db.webhookEvent.create({
    data: { provider: "meta", eventId: "leadgen.sample.001", eventType: "leadgen", status: "SUCCESS", processedAt: new Date() },
  });

  // --- Courier providers (Pathao, Steadfast, RedX as MOCK for testability) ---
  for (const c of [
    { name: "Pathao", code: "PTHO", apiUrl: "", isMock: true },
    { name: "Steadfast", code: "STDF", apiUrl: "", isMock: true },
    { name: "RedX", code: "REDX", apiUrl: "", isMock: true },
  ]) {
    const existing = await db.courierProvider.findUnique({ where: { code: c.code } });
    if (!existing) await db.courierProvider.create({ data: { ...c, isActive: true } });
  }

  // --- Automation rules (fire-and-forget, non-blocking) ---
  const autoRules = [
    { name: "New Order WhatsApp Confirm", event: "ORDER_CREATED", action: "SEND_WHATSAPP_TEMPLATE", templateName: "order_received" },
    { name: "Payment Receipt Notify", event: "PAYMENT_RECEIVED", action: "SEND_WHATSAPP_TEMPLATE", templateName: "payment_received" },
    { name: "Order Shipped Tracking", event: "ORDER_SHIPPED", action: "SEND_WHATSAPP_TEMPLATE", templateName: "order_shipped" },
    { name: "Order Delivered Thanks", event: "ORDER_DELIVERED", action: "SEND_WHATSAPP_TEMPLATE", templateName: "order_delivered" },
    { name: "Order Cancelled Notify", event: "ORDER_CANCELLED", action: "SEND_WHATSAPP_TEMPLATE", templateName: "order_cancelled" },
    { name: "New Lead In-app Alert", event: "LEAD_CREATED", action: "CREATE_NOTIFICATION" },
  ];
  for (const r of autoRules) {
    const existing = await db.automationRule.findUnique({ where: { name: r.name } });
    if (!existing) await db.automationRule.create({ data: { ...r, isActive: true } });
  }

  // --- A few sales-pipeline entries for the Sales Pipeline UI ---
  const pipelineCustomers = customerIds.slice(0, 6);
  for (let i = 0; i < pipelineCustomers.length; i++) {
    await db.salesPipelineEntry.create({
      data: {
        customerId: pipelineCustomers[i],
        value: new Prisma.Decimal(pick([1500, 3000, 7500, 12500, 22000, 4500])),
        stage: pick(["NEW", "CONTACTED", "QUALIFIED", "NEGOTIATION", "ORDER_CREATED", "WON"]),
        assignedToId: userMap.SALES,
      },
    });
  }

  // --- Lead follow-ups for the Lead Pipeline ---
  const leads = await db.metaLead.findMany({ take: 6 });
  for (let i = 0; i < leads.length; i++) {
    await db.leadFollowUp.upsert({
      where: { leadId: leads[i].id },
      create: { leadId: leads[i].id, pipelineStage: pick(["NEW", "CONTACTED", "QUALIFIED", "NEGOTIATION"]), assignedToId: userMap.SALES, followUpDate: new Date(Date.now() + (i + 1) * 86400000) },
      update: {},
    });
  }

  // --- Telegram Bot config + sample groups ---
  const tgBot = await db.telegramBot.upsert({
    where: { botToken: "PLACEHOLDER_BOT_TOKEN_REPLACE_WITH_REAL_TELEGRAM_BOT_TOKEN" },
    create: {
      name: "Z-CRM Bot",
      botToken: "PLACEHOLDER_BOT_TOKEN_REPLACE_WITH_REAL_TELEGRAM_BOT_TOKEN",
      botUsername: "@zcrm_bot",
      webhookSecret: "zcrm_tg_webhook_secret",
      status: "CONNECTED",
      defaultLanguage: "en",
    },
    update: { status: "CONNECTED" },
  });

  const tgGroups = [
    { chatId: "-1001234567890", chatTitle: "Z-CRM Sales", roleName: "SALES", isActive: true },
    { chatId: "-1001234567891", chatTitle: "Z-CRM Warehouse", roleName: "INVENTORY", isActive: true },
    { chatId: "-1001234567892", chatTitle: "Z-CRM Finance", roleName: "ACCOUNTANT", isActive: true },
    { chatId: "-1001234567893", chatTitle: "Z-CRM Management", roleName: "MANAGER", isActive: true },
    { chatId: "-1001234567894", chatTitle: "Z-CRM Admin", roleName: "ADMIN", isActive: true },
  ];
  for (const g of tgGroups) {
    const existing = await db.telegramGroup.findUnique({ where: { chatId: g.chatId } });
    if (!existing) await db.telegramGroup.create({ data: { ...g, botId: tgBot.id, chatType: "supergroup" } });
  }

  // Seed a few Telegram notification rules (Sales group gets new orders + leads; Warehouse gets low stock)
  const salesGroup = await db.telegramGroup.findUnique({ where: { chatId: "-1001234567890" } });
  const warehouseGroup = await db.telegramGroup.findUnique({ where: { chatId: "-1001234567891" } });
  const financeGroup = await db.telegramGroup.findUnique({ where: { chatId: "-1001234567892" } });
  if (salesGroup) {
    for (const evt of ["NEW_ORDER", "NEW_LEAD", "NEW_MESSAGE", "DELIVERY_UPDATE"]) {
      await db.telegramNotificationRule.upsert({ where: { groupId_eventType: { groupId: salesGroup.id, eventType: evt } }, create: { groupId: salesGroup.id, eventType: evt, isActive: true }, update: {} });
    }
  }
  if (warehouseGroup) {
    for (const evt of ["LOW_STOCK", "OUT_OF_STOCK", "STOCK_COUNT_APPROVAL"]) {
      await db.telegramNotificationRule.upsert({ where: { groupId_eventType: { groupId: warehouseGroup.id, eventType: evt } }, create: { groupId: warehouseGroup.id, eventType: evt, isActive: true }, update: {} });
    }
  }
  if (financeGroup) {
    for (const evt of ["PAYMENT_RECEIVED", "DUE_PAYMENT"]) {
      await db.telegramNotificationRule.upsert({ where: { groupId_eventType: { groupId: financeGroup.id, eventType: evt } }, create: { groupId: financeGroup.id, eventType: evt, isActive: true }, update: {} });
    }
  }

  // --- Payment gateways for billing system ---
  const gateways = [
    { name: "BKASH", displayName: "bKash", type: "MOBILE_BANKING", merchantNumber: "01711-0000001", instructions: "Send money to 01711-0000001 (Personal), enter your bKash number + TrxID", sortOrder: 1 },
    { name: "NAGAD", displayName: "Nagad", type: "MOBILE_BANKING", merchantNumber: "01711-0000002", instructions: "Send money to 01711-0000002 (Personal), enter your Nagad number + TrxID", sortOrder: 2 },
    { name: "BANK", displayName: "Bank Transfer", type: "BANK", instructions: "Transfer to: Z-CRM, City Bank, A/C: 1234567890, Branch: Gulshan, Routing: 123456789", sortOrder: 3 },
    { name: "CASH", displayName: "Cash", type: "CASH", instructions: "Pay cash at our office. Admin will verify manually.", sortOrder: 4 },
    { name: "WALLET", displayName: "Wallet Balance", type: "MANUAL", instructions: "Pay from your Z-CRM wallet balance.", sortOrder: 5 },
    { name: "MANUAL", displayName: "Manual / Other", type: "MANUAL", instructions: "Admin will verify your payment manually.", sortOrder: 99 },
  ];
  for (const g of gateways) {
    const existing = await db.paymentGateway.findUnique({ where: { name: g.name } });
    if (!existing) await db.paymentGateway.create({ data: { ...g, isActive: true } });
  }

  // --- Payout accounts (super admin's personal accounts for sending money) ---
  const payoutAccounts = [
    { name: "bKash Personal", type: "BKASH", accountNumber: "01711-9999991", accountHolder: "Super Admin", isDefault: true },
    { name: "Nagad Personal", type: "NAGAD", accountNumber: "01711-9999992", accountHolder: "Super Admin" },
    { name: "City Bank", type: "BANK", accountNumber: "1234567890", accountHolder: "Super Admin", bankName: "City Bank", branch: "Gulshan", routingNumber: "123456789" },
  ];
  for (const a of payoutAccounts) {
    const existing = await db.payoutAccount.findFirst({ where: { accountNumber: a.accountNumber } });
    if (!existing) await db.payoutAccount.create({ data: { ...a, isActive: true } });
  }

  // --- Sample wallet for admin ---
  const adminUser = await db.user.findUnique({ where: { email: "admin@zcrm.local" } });
  if (adminUser) {
    const existingWallet = await db.wallet.findUnique({ where: { userId: adminUser.id } });
    if (!existingWallet) await db.wallet.create({ data: { userId: adminUser.id, balance: new Prisma.Decimal(10000), totalDeposited: new Prisma.Decimal(10000) } });
  }

  console.log("Seed complete. Login users:");
  for (const u of usersData) {
    console.log(`  ${u.role.padEnd(12)} ${u.email} / ${u.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
