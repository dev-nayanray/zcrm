import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";

// CourierService — provider abstraction for Bangladesh couriers
// (Pathao, Steadfast, RedX, Other). Providers are stored in CourierProvider;
// when `isMock=true`, the service returns simulated responses so the system
// is fully testable without real API credentials.
//
// Architecture:
//   Order → DeliveryService → CourierService.createShipment(providerId, …)
//        → CourierProvider (config) → Courier API (or mock)
//        → tracking/status updates back into Delivery
//
// To add a real provider: create a CourierProvider row with apiUrl/apiKey/secretKey
// and isMock=false. The sendRequest() function posts to apiUrl with the stored key.
export const CourierService = {
  async listProviders() {
    const rows = await db.courierProvider.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { deliveries: true } } } });
    // NEVER expose apiKey / secretKey
    return rows.map((p) => ({ ...p, apiKey: undefined, secretKey: undefined, hasKey: !!p.apiKey }));
  },

  async createProvider(data: { name: string; code: string; apiUrl?: string; apiKey?: string; secretKey?: string; isMock?: boolean; config?: string }) {
    const existing = await db.courierProvider.findUnique({ where: { code: data.code } });
    if (existing) throw new Error("Courier code already exists");
    return db.courierProvider.create({ data: { name: data.name, code: data.code, apiUrl: data.apiUrl, apiKey: data.apiKey, secretKey: data.secretKey, isMock: data.isMock ?? true, isActive: true, config: data.config } });
  },

  async updateProvider(id: string, data: Partial<{ name: string; apiUrl: string; apiKey: string; secretKey: string; isMock: boolean; isActive: boolean; config: string }>) {
    return db.courierProvider.update({ where: { id }, data });
  },

  async deleteProvider(id: string) {
    return db.courierProvider.delete({ where: { id } });
  },

  // Create a shipment with the chosen provider. Returns { consignmentId, trackingNumber, charge }.
  async createShipment(opts: { providerId: string; deliveryId: string; recipientName: string; recipientPhone: string; recipientAddress: string; codAmount: Prisma.Decimal | number | string; orderId: string }) {
    const provider = await db.courierProvider.findUnique({ where: { id: opts.providerId } });
    if (!provider) throw new Error("Courier provider not found");
    if (!provider.isActive) throw new Error("Courier provider is not active");
    if (provider.isMock || !provider.apiUrl) {
      // Mock provider: simulate a successful shipment creation
      const consignmentId = `MOCK-${provider.code.toUpperCase()}-${Date.now()}`;
      const trackingNumber = `TRK${Math.floor(Math.random() * 900000 + 100000)}`;
      const charge = new Prisma.Decimal(60); // mock delivery charge
      return { consignmentId, trackingNumber, charge: charge.toFixed(2), mock: true };
    }
    // Real provider: POST to apiUrl with Authorization
    try {
      const res = await fetch(`${provider.apiUrl}/shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey ?? ""}`, "X-Secret": provider.secretKey ?? "" },
        body: JSON.stringify({
          recipient: { name: opts.recipientName, phone: opts.recipientPhone, address: opts.recipientAddress },
          codAmount: toDecimal(opts.codAmount).toFixed(2),
          reference: opts.orderId,
        }),
      });
      if (!res.ok) throw new Error(`Courier API error ${res.status}`);
      const data = await res.json();
      return { consignmentId: data.consignmentId ?? data.id, trackingNumber: data.trackingNumber, charge: data.charge ?? "0.00", mock: false };
    } catch (e) {
      throw new Error(`Courier shipment failed: ${(e as Error).message}`);
    }
  },

  // Track a shipment by consignment id. Mock returns deterministic "IN_TRANSIT".
  async trackShipment(providerId: string, consignmentId: string) {
    const provider = await db.courierProvider.findUnique({ where: { id: providerId } });
    if (!provider) throw new Error("Courier provider not found");
    if (provider.isMock || !provider.apiUrl) {
      return { status: "IN_TRANSIT", message: "Mock tracking: package is in transit", updated: new Date().toISOString() };
    }
    try {
      const res = await fetch(`${provider.apiUrl}/track/${consignmentId}`, { headers: { Authorization: `Bearer ${provider.apiKey ?? ""}` } });
      if (!res.ok) throw new Error(`Courier tracking error ${res.status}`);
      return await res.json();
    } catch (e) {
      throw new Error(`Courier tracking failed: ${(e as Error).message}`);
    }
  },
};

void toDecimal;
