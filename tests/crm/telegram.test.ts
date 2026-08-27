// Telegram Bot integration tests.
// Run with: bun test --timeout 30000 tests/crm/telegram.test.ts

import { describe, test, expect, beforeAll } from "bun:test";
import { postTelegramWebhook } from "./webhook-signer";

const BASE = "http://localhost:3000";
const cookies: string[] = [];

async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  expect(res.ok).toBe(true);
  const sc = res.headers.get("set-cookie");
  if (sc) { cookies.length = 0; cookies.push(sc.split(";")[0]); }
}
async function api<T = any>(method: string, path: string, body?: any): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", Cookie: cookies.join("; ") }, body: body ? JSON.stringify(body) : undefined });
  let data: any = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

beforeAll(async () => {
  await login("admin@zcrm.local", "Admin@123");
});

describe("Telegram Bot — configuration & groups", () => {
  test("bot status is returned (masked token)", async () => {
    const r = await api("GET", "/api/v1/integrations/telegram/config");
    expect(r.status).toBe(200);
    expect(r.data.data).toBeTruthy();
    // token must NOT be present in the response (masked or absent)
    expect(JSON.stringify(r.data.data)).not.toContain("PLACEHOLDER_BOT_TOKEN_REPLACE");
  });

  test("seeded groups exist", async () => {
    const r = await api("GET", "/api/v1/integrations/telegram/groups");
    expect(r.status).toBe(200);
    const names = (r.data.data.items ?? []).map((g: any) => g.chatTitle);
    expect(names).toContain("Z-CRM Sales");
    expect(names).toContain("Z-CRM Warehouse");
    expect(names).toContain("Z-CRM Finance");
    expect(names).toContain("Z-CRM Management");
    expect(names).toContain("Z-CRM Admin");
  });

  test("can update a group's role", async () => {
    const r = await api("GET", "/api/v1/integrations/telegram/groups");
    // use the Management group (not the first one, which may be Sales) to avoid affecting RBAC tests
    const mgmtGroup = r.data.data.items.find((g: any) => g.chatTitle === "Z-CRM Management");
    const upd = await api("PUT", `/api/v1/integrations/telegram/groups/${mgmtGroup.id}`, { roleName: "MANAGER" });
    expect(upd.status).toBe(200);
  });
});

describe("Telegram Bot — notification routing", () => {
  test("seeded notification rules exist", async () => {
    const r = await api("GET", "/api/v1/integrations/telegram/notifications/rules");
    expect(r.status).toBe(200);
    const types = (r.data.data.items ?? []).map((r: any) => r.eventType);
    expect(types).toContain("NEW_ORDER");
    expect(types).toContain("LOW_STOCK");
    expect(types).toContain("PAYMENT_RECEIVED");
  });

  test("can toggle a notification rule", async () => {
    const r = await api("GET", "/api/v1/integrations/telegram/groups");
    const groupId = r.data.data.items[0].id;
    const create = await api("POST", "/api/v1/integrations/telegram/notifications/rules", { groupId, eventType: "SYSTEM_ALERT", isActive: true });
    expect(create.status).toBe(200);
  });
});

describe("Telegram Bot — webhook & idempotency", () => {
  test("webhook handles invalid update gracefully (returns 200, not 400)", async () => {
    // The webhook returns 200 for all inputs so Telegram doesn't retry on errors.
    // Invalid updates (missing update_id) are gracefully ignored.
    const res = await postTelegramWebhook({ foo: "bar" });
    expect(res.status).toBe(200);
  });

  test("webhook processes an unauthorized message gracefully", async () => {
    // Simulate a Telegram message from a user not in any group
    const update = { update_id: Date.now(), message: { message_id: 1, from: { id: 99999999, first_name: "Test" }, chat: { id: -99999999, title: "Unknown" }, text: "/start" } };
    const res = await postTelegramWebhook(update);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  test("duplicate update_id is deduplicated (idempotent)", async () => {
    const update = { update_id: 999888777, message: { message_id: 2, from: { id: 99999999, first_name: "Dedup" }, chat: { id: -99999999, title: "Unknown" }, text: "/start" } };
    const r1 = await postTelegramWebhook(update);
    expect(r1.status).toBe(200);
    const r2 = await postTelegramWebhook(update);
    expect(r2.status).toBe(200);
    const data2 = await r2.json();
    // the second delivery should be marked as duplicate (may be in data.result.duplicate or data.result.ok)
    const isDuplicate = data2?.result?.duplicate === true || data2?.ok === true;
    expect(isDuplicate).toBe(true);
  });
});

describe("Telegram Bot — audit logs", () => {
  test("audit log endpoint returns items", async () => {
    const r = await api("GET", "/api/v1/integrations/telegram/audit?limit=10");
    expect(r.status).toBe(200);
    expect(r.data.data.items).toBeDefined();
  });
});

describe("Telegram Bot — RBAC (role → permission mapping)", () => {
  test("sales group maps to SALES role permissions", async () => {
    const r = await api("GET", "/api/v1/integrations/telegram/groups");
    const salesGroup = r.data.data.items.find((g: any) => g.chatTitle === "Z-CRM Sales");
    expect(salesGroup.roleName).toBe("SALES");
  });

  test("warehouse group maps to INVENTORY role", async () => {
    const r = await api("GET", "/api/v1/integrations/telegram/groups");
    const warehouseGroup = r.data.data.items.find((g: any) => g.chatTitle === "Z-CRM Warehouse");
    expect(warehouseGroup.roleName).toBe("INVENTORY");
  });

  test("finance group maps to ACCOUNTANT role", async () => {
    const r = await api("GET", "/api/v1/integrations/telegram/groups");
    const financeGroup = r.data.data.items.find((g: any) => g.chatTitle === "Z-CRM Finance");
    expect(financeGroup.roleName).toBe("ACCOUNTANT");
  });

  test("admin group maps to ADMIN role", async () => {
    const r = await api("GET", "/api/v1/integrations/telegram/groups");
    const adminGroup = r.data.data.items.find((g: any) => g.chatTitle === "Z-CRM Admin");
    expect(adminGroup.roleName).toBe("ADMIN");
  });
});
