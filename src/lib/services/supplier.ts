import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";
import { getCurrentUser } from "@/lib/auth";
import { AuditService } from "./audit";

// SupplierService — supplier accounting dashboard + payments.
// Outstanding payable = Σ purchase.dueAmount (excluding CANCELLED).
// Supplier payments reduce the linked purchase's dueAmount (and increase
// paidAmount) — no duplicate accounting logic.
//
// FIX: recordPayment now validates that the linked purchase belongs to
// the named supplier (was: any purchaseId was accepted, even one from a
// different supplier). It also rejects payments against PENDING or
// CANCELLED purchases (no goods were received → no payment is owed), and
// rejects overpayment (amount > dueAmount). The dashboard now excludes
// CANCELLED purchases from totals.
export const SupplierService = {
  async dashboard(supplierId: string) {
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new Error("Supplier not found");
    // Exclude CANCELLED purchases — they aren't owed.
    const purchases = await db.purchase.findMany({ where: { supplierId, status: { not: "CANCELLED" } } });
    const totalPurchases = purchases.reduce((s, p) => s.add(p.total), new Prisma.Decimal(0));
    const totalPaid = purchases.reduce((s, p) => s.add(p.paidAmount), new Prisma.Decimal(0));
    const totalDue = purchases.reduce((s, p) => s.add(p.dueAmount), new Prisma.Decimal(0));
    const payAgg = await db.supplierPayment.aggregate({ where: { supplierId }, _sum: { amount: true }, _count: true });
    return {
      supplier,
      purchaseCount: purchases.length,
      totalPurchases: totalPurchases.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      outstandingPayable: totalDue.toFixed(2),
      supplierPayments: (payAgg._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      paymentCount: payAgg._count,
    };
  },

  async recordPayment(data: { supplierId: string; purchaseId?: string; amount: number | string; method: string; transactionReference?: string; notes?: string }) {
    return db.$transaction(async (tx) => {
      const user = await getCurrentUser();
      const amount = toDecimal(data.amount);
      if (amount.lte(0)) throw new Error("Payment amount must be positive");

      // If a purchaseId is provided, validate it belongs to the named
      // supplier and is in RECEIVED status, and that the payment does not
      // exceed the due amount. This prevents cross-supplier confusion,
      // paying for un-received or cancelled purchases, and overpaying.
      let purchase: { id: string; supplierId: string; status: string; paidAmount: Prisma.Decimal; dueAmount: Prisma.Decimal; total: Prisma.Decimal } | null = null;
      if (data.purchaseId) {
        purchase = await tx.purchase.findUnique({ where: { id: data.purchaseId } });
        if (!purchase) throw new Error("Purchase not found");
        if (purchase.supplierId !== data.supplierId) {
          throw new Error("Purchase does not belong to this supplier");
        }
        if (purchase.status !== "RECEIVED") {
          throw new Error(`Cannot pay for a purchase with status ${purchase.status}. Purchase must be RECEIVED.`);
        }
        if (amount.gt(purchase.dueAmount)) {
          throw new Error(`Payment amount (${amount.toFixed(2)}) exceeds due amount (${purchase.dueAmount.toFixed(2)})`);
        }
      }

      const payment = await tx.supplierPayment.create({
        data: { supplierId: data.supplierId, purchaseId: data.purchaseId, amount, method: data.method, transactionReference: data.transactionReference, notes: data.notes, createdBy: user?.id },
      });
      // Reduce the linked purchase's dueAmount / increase paidAmount.
      if (purchase) {
        const newPaid = toDecimal(purchase.paidAmount).plus(amount);
        const newDue = toDecimal(purchase.dueAmount).minus(amount);
        let paymentStatus: "PARTIAL" | "PAID" = "PARTIAL";
        if (newPaid.gte(toDecimal(purchase.total)) && toDecimal(purchase.total).gt(0)) paymentStatus = "PAID";
        await tx.purchase.update({ where: { id: purchase.id }, data: { paidAmount: newPaid, dueAmount: newDue, paymentStatus } });
      }
      await AuditService.log({ userId: user?.id, action: "SUPPLIER_PAYMENT", entity: "SupplierPayment", entityId: payment.id, changes: { supplierId: data.supplierId, purchaseId: data.purchaseId, amount: amount.toFixed(2) } }, tx);
      return payment;
    }, { timeout: 20000, maxWait: 10000 });
  },

  async listPayments(opts: { page: number; limit: number; supplierId?: string }) {
    const where: Prisma.SupplierPaymentWhereInput = {};
    if (opts.supplierId) where.supplierId = opts.supplierId;
    const [items, total] = await Promise.all([
      db.supplierPayment.findMany({ where, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.limit, take: opts.limit, include: { supplier: { select: { name: true } }, purchase: { select: { purchaseNumber: true } } } }),
      db.supplierPayment.count({ where }),
    ]);
    return { items: items.map((p) => ({ ...p, amount: p.amount.toFixed(2) })), total };
  },
};
