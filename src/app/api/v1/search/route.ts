import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requireAuth } from "@/lib/guards";
import { db } from "@/lib/db";
import type { Permission } from "@/lib/constants";
import { hasPermission } from "@/lib/auth";

// GET /api/v1/search?q=<query>&limit=<n>
//
// Unified multi-entity search. Searches across orders, customers, products,
// payments, purchases, suppliers, and deliveries in a single request.
//
// RBAC: results are filtered by the user's permissions. A SALES user
// without suppliers:read will never see supplier results. This is enforced
// on the backend — the frontend can't bypass it.
//
// Performance: each entity query uses `take: limit` (default 5) and an
// indexed WHERE clause. No full-table scans.

type SearchGroup = {
  type: string;
  id: string;
  label: string;
  subtitle: string;
  route: string;
  meta?: string;
};

export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireAuth();
    if (authErr) return authErr;

    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "5", 10) || 5, 10);

    if (q.length < 2) return ok({ query: q, groups: [] });

    const can = (perm: Permission) => hasPermission(user!, perm);

    const groups: { label: string; items: SearchGroup[] }[] = [];

    // Orders
    if (can("orders:read")) {
      try {
        const orders = await db.order.findMany({
          where: {
            OR: [
              { orderNumber: { contains: q, mode: "insensitive" } },
              { customer: { phone: { contains: q } } },
              { customer: { name: { contains: q, mode: "insensitive" } } },
              { externalId: { contains: q } },
            ],
          },
          take: limit,
          orderBy: { createdAt: "desc" },
          select: { id: true, orderNumber: true, status: true, total: true, customer: { select: { name: true } } },
        });
        if (orders.length) {
          groups.push({
            label: "Orders",
            items: orders.map((o) => ({
              type: "order", id: o.id, label: o.orderNumber,
              subtitle: `${o.customer?.name ?? "—"} · ৳${Number(o.total).toFixed(2)}`,
              route: "orders/detail", meta: o.status,
            })),
          });
        }
      } catch { /* ignore — orders collection may not exist */ }
    }

    // Customers
    if (can("customers:read")) {
      try {
        const customers = await db.customer.findMany({
          where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] },
          take: limit,
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, phone: true },
        });
        if (customers.length) {
          groups.push({
            label: "Customers",
            items: customers.map((c) => ({
              type: "customer", id: c.id, label: c.name, subtitle: c.phone, route: "customers/detail",
            })),
          });
        }
      } catch { /* ignore */ }
    }

    // Products
    if (can("products:read")) {
      try {
        const products = await db.product.findMany({
          where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] },
          take: limit,
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, sku: true, sellingPrice: true },
        });
        if (products.length) {
          groups.push({
            label: "Products",
            items: products.map((p) => ({
              type: "product", id: p.id, label: p.name, subtitle: `${p.sku} · ৳${p.sellingPrice.toFixed(2)}`,
              route: "products/detail",
            })),
          });
        }
      } catch { /* ignore */ }
    }

    // Payments
    if (can("payments:read")) {
      try {
        const payments = await db.payment.findMany({
          where: { OR: [{ transactionReference: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }, { customer: { phone: { contains: q } } }] },
          take: limit,
          orderBy: { createdAt: "desc" },
          select: { id: true, amount: true, method: true, createdAt: true, order: { select: { orderNumber: true } }, customer: { select: { name: true } } },
        });
        if (payments.length) {
          groups.push({
            label: "Payments",
            items: payments.map((p) => ({
              type: "payment", id: p.id, label: `৳${Number(p.amount).toFixed(2)} (${p.method})`,
              subtitle: `${p.order?.orderNumber ?? "—"} · ${p.customer?.name ?? "—"}`, route: "payments",
            })),
          });
        }
      } catch { /* ignore */ }
    }

    // Purchases
    if (can("purchases:read")) {
      try {
        const purchases = await db.purchase.findMany({
          where: { OR: [{ purchaseNumber: { contains: q, mode: "insensitive" } }, { supplier: { name: { contains: q, mode: "insensitive" } } }] },
          take: limit,
          orderBy: { createdAt: "desc" },
          select: { id: true, purchaseNumber: true, total: true, status: true, supplier: { select: { name: true } } },
        });
        if (purchases.length) {
          groups.push({
            label: "Purchases",
            items: purchases.map((p) => ({
              type: "purchase", id: p.id, label: p.purchaseNumber,
              subtitle: `${p.supplier?.name ?? "—"} · ৳${Number(p.total).toFixed(2)}`, route: "purchases", meta: p.status,
            })),
          });
        }
      } catch { /* ignore */ }
    }

    // Suppliers
    if (can("suppliers:read")) {
      try {
        const suppliers = await db.supplier.findMany({
          where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] },
          take: limit,
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, phone: true },
        });
        if (suppliers.length) {
          groups.push({
            label: "Suppliers",
            items: suppliers.map((s) => ({
              type: "supplier", id: s.id, label: s.name, subtitle: s.phone ?? "—", route: "suppliers",
            })),
          });
        }
      } catch { /* ignore */ }
    }

    // Deliveries
    if (can("deliveries:read")) {
      try {
        const deliveries = await db.delivery.findMany({
          where: { OR: [{ trackingNumber: { contains: q, mode: "insensitive" } }, { order: { orderNumber: { contains: q, mode: "insensitive" } } }] },
          take: limit,
          orderBy: { createdAt: "desc" },
          select: { id: true, trackingNumber: true, status: true, order: { select: { id: true, orderNumber: true } } },
        });
        if (deliveries.length) {
          groups.push({
            label: "Deliveries",
            items: deliveries.map((d) => ({
              type: "delivery", id: d.id, label: d.order?.orderNumber ?? "—",
              subtitle: d.trackingNumber ?? "—", route: "deliveries/detail", meta: d.status,
            })),
          });
        }
      } catch { /* ignore */ }
    }

    return ok({ query: q, groups });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

void badRequest;
