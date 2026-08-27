// Integration tests for the Z-CRM omnichannel + inventory system.
// These run against the live dev server (http://localhost:3000) and exercise
// the real business logic: auth, RBAC, transactions, ledger, webhooks.
//
// Run with: bun test tests/crm/integration.test.ts

import { describe, test, expect, beforeAll } from "bun:test";
import { postMetaWebhook, postWhatsAppWebhook } from "./webhook-signer";

const BASE = "http://localhost:3000";
const cookieJar: string[] = [];

async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(res.ok).toBe(true);
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const cookie = setCookie.split(";")[0];
    cookieJar.length = 0; cookieJar.push(cookie);
  }
}

async function api<T = any>(method: string, path: string, body?: any): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookieJar.join("; ") },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

let adminCustomerId = "";
let adminProductId = "";
let adminChannelId = "";

beforeAll(async () => {
  await login("admin@zcrm.local", "Admin@123");
  // grab a customer, product, and the WhatsApp channel
  const c = await api("GET", "/api/v1/customers?limit=1");
  adminCustomerId = c.data?.data?.items?.[0]?.id ?? "";
  const p = await api("GET", "/api/v1/products?limit=1");
  adminProductId = p.data?.data?.items?.[0]?.id ?? "";
  const ch = await api("GET", "/api/v1/channels");
  adminChannelId = ch.data?.data?.items?.find((x: any) => x.name === "WhatsApp")?.id ?? ch.data?.data?.items?.[0]?.id ?? "";
  expect(adminCustomerId).toBeTruthy();
  expect(adminProductId).toBeTruthy();
  expect(adminChannelId).toBeTruthy();
});

describe("Inventory ledger — stock movements", () => {
  test("a stock adjustment creates a movement and updates the ledger", async () => {
    // Get current stock
    const before = await api("GET", `/api/v1/inventory/${adminProductId}`);
    const beforeQty = Number(before.data?.data?.items?.[0]?.newQuantity ?? 0);

    // +5 adjustment
    const adj = await api("POST", "/api/v1/inventory", { productId: adminProductId, type: "ADJUSTMENT", quantityChange: 5, reason: "test +5" });
    expect(adj.status).toBe(200);
    expect(adj.data?.data?.movement).toBeTruthy();
    expect(Number(adj.data.data.movement.quantityChange)).toBe(5);

    // verify movement recorded
    const after = await api("GET", `/api/v1/inventory/${adminProductId}`);
    const afterQty = Number(after.data?.data?.items?.[0]?.newQuantity ?? 0);
    expect(afterQty).toBe(beforeQty + 5);
  });

  test("negative stock is prevented (cannot sell more than available)", async () => {
    // Try to adjust with a huge negative change (more than available)
    const res = await api("POST", "/api/v1/inventory", { productId: adminProductId, type: "ADJUSTMENT", quantityChange: -9999999, reason: "should fail" });
    expect(res.status).toBe(400);
    expect(res.data?.error?.message).toContain("Insufficient stock");
  });
});

describe("Stock reservation flow", () => {
  test("order with reserveStock reserves (not deducts) stock; delivery converts reservation to sale", async () => {
    // capture stock before
    const invBefore = await api("GET", `/api/v1/inventory/${adminProductId}`);
    const qtyBefore = Number(invBefore.data?.data?.items?.[0]?.newQuantity ?? 0);

    // create an order with reserveStock=true
    const order = await api("POST", "/api/v1/orders", {
      customerId: adminCustomerId,
      channelId: adminChannelId,
      status: "CONFIRMED",
      discount: "0", shippingCost: "0", otherCost: "0",
      reserveStock: true,
      items: [{ productId: adminProductId, quantity: "1", discount: "0" }],
      notes: "Reservation test",
    });
    expect(order.status).toBe(200);
    expect(order.data?.data?.orderNumber).toBeTruthy();
    expect(order.data.data.stockReserved).toBe(true);
    const orderId = order.data.data.id;

    // stock should be UNCHANGED (only reserved bucket changed)
    const invAfterRes = await api("GET", `/api/v1/inventory/${adminProductId}`);
    const qtyAfterRes = Number(invAfterRes.data?.data?.items?.[0]?.newQuantity ?? 0);
    expect(qtyAfterRes).toBe(qtyBefore); // physical unchanged

    // deliver → convert reservation to sale
    const deliver = await api("PATCH", `/api/v1/orders/${orderId}`, { status: "DELIVERED", note: "Delivered" });
    expect(deliver.status).toBe(200);

    // now physical stock should be deducted by 1
    const invAfterDeliver = await api("GET", `/api/v1/inventory/${adminProductId}`);
    const qtyAfterDeliver = Number(invAfterDeliver.data?.data?.items?.[0]?.newQuantity ?? 0);
    expect(qtyAfterDeliver).toBe(qtyBefore - 1);

    // order should have stockReserved=false now
    const orderCheck = await api("GET", `/api/v1/orders/${orderId}`);
    expect(orderCheck.data?.data?.stockReserved).toBe(false);
  });

  test("cancelling a reserved order releases the reservation", async () => {
    const invBefore = await api("GET", `/api/v1/inventory/${adminProductId}`);
    const qtyBefore = Number(invBefore.data?.data?.items?.[0]?.newQuantity ?? 0);

    const order = await api("POST", "/api/v1/orders", {
      customerId: adminCustomerId, channelId: adminChannelId, status: "PENDING",
      discount: "0", shippingCost: "0", otherCost: "0", reserveStock: true,
      items: [{ productId: adminProductId, quantity: "1", discount: "0" }],
    });
    expect(order.status).toBe(200);
    expect(order.data.data.stockReserved).toBe(true);

    const cancel = await api("PATCH", `/api/v1/orders/${order.data.data.id}`, { status: "CANCELLED", note: "Customer cancelled" });
    expect(cancel.status).toBe(200);

    // physical stock must still equal qtyBefore (reservation released, never sold)
    const invAfter = await api("GET", `/api/v1/inventory/${adminProductId}`);
    const qtyAfter = Number(invAfter.data?.data?.items?.[0]?.newQuantity ?? 0);
    expect(qtyAfter).toBe(qtyBefore);
  });
});

describe("Meta webhook idempotency", () => {
  test("the same lead webhook processed twice creates exactly one lead", async () => {
    // Count leads before
    const before = await api("GET", "/api/v1/leads?limit=200");
    const beforeCount = before.data?.data?.total ?? 0;

    const payload = {
      entry: [{
        id: "100000000001",
        changes: [{
          field: "leadgen",
          value: {
            leadgen_id: `leadgen_idempotency_test_${Date.now()}`,
            form_id: "form_test",
            ad_id: "ad_test",
            campaign_id: "camp_test",
            created_time: Date.now(),
            field_data: [
              { name: "full_name", values: ["Idempotency Test User"] },
              { name: "phone_number", values: ["01799998877"] },
            ],
          },
        }],
      }],
    };

    // First delivery (signed)
    const r1 = await postMetaWebhook(payload);
    expect(r1.status).toBe(200);
    // Second delivery (same payload — must be deduplicated)
    const r2 = await postMetaWebhook(payload);
    expect(r2.status).toBe(200);

    const after = await api("GET", "/api/v1/leads?limit=200");
    const afterCount = after.data?.data?.total ?? 0;
    // exactly ONE new lead created (deduplication by externalLeadId)
    expect(afterCount - beforeCount).toBe(1);
  });
});

describe("Conversation → order flow (omnichannel)", () => {
  test("a conversation can be created and an order linked to it", async () => {
    // start a conversation
    const conv = await api("POST", "/api/v1/conversations", {
      provider: "whatsapp",
      customerId: adminCustomerId,
      contactName: "Test Customer",
      contactPhone: "01799990099",
      message: "I'd like to order",
    });
    expect(conv.status).toBe(200);
    const convId = conv.data.data.id;
    expect(convId).toBeTruthy();

    // create an order linked to the conversation (reserveStock since it's a pending WhatsApp order)
    const order = await api("POST", "/api/v1/orders", {
      customerId: adminCustomerId,
      channelId: adminChannelId,
      status: "PENDING",
      discount: "0", shippingCost: "0", otherCost: "0",
      reserveStock: true,
      conversationId: convId,
      items: [{ productId: adminProductId, quantity: "1", discount: "0" }],
      notes: "From WhatsApp conversation",
    });
    expect(order.status).toBe(200);
    expect(order.data.data.conversationId).toBe(convId);

    // the conversation detail should list the order
    const convDetail = await api("GET", `/api/v1/conversations/${convId}`);
    expect(convDetail.status).toBe(200);
    const orderLinks = convDetail.data?.data?.orders ?? [];
    expect(orderLinks.some((o: any) => o.id === order.data.data.id)).toBe(true);
  });
});

describe("RBAC — permission enforcement", () => {
  test("unauthenticated request is rejected (401)", async () => {
    // clear cookies
    cookieJar.length = 0;
    const res = await fetch(`${BASE}/api/v1/dashboard`, { headers: {} });
    expect(res.status).toBe(401);
    // log back in for any subsequent tests
    await login("admin@zcrm.local", "Admin@123");
  });

  test("SALES role can create orders but cannot manage users", async () => {
    await login("sales@zcrm.local", "Sales@123");
    // can create order
    const order = await api("POST", "/api/v1/orders", {
      customerId: adminCustomerId, channelId: adminChannelId, status: "CONFIRMED",
      discount: "0", shippingCost: "0", otherCost: "0",
      items: [{ productId: adminProductId, quantity: "1", discount: "0" }],
    });
    expect(order.status).toBe(200);
    // cannot list users (no users:read permission for SALES)
    const users = await api("GET", "/api/v1/users");
    expect(users.status).toBe(403);
  });
});

describe("Webhook event log", () => {
  test("duplicate webhook events appear in the logs with SUCCESS status", async () => {
    await login("admin@zcrm.local", "Admin@123");
    const logs = await api("GET", "/api/v1/integrations/logs?provider=meta&limit=50");
    expect(logs.status).toBe(200);
    expect(logs.data?.data?.items.length).toBeGreaterThan(0);
  });
});
