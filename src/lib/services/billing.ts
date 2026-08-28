import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";
import { AuditService } from "./audit";
import { getCurrentUser } from "@/lib/auth";

// ─────────────────────────────────────────────
// BillingService — subscription lifecycle, payment processing,
// wallet management, and payout management for selling Z-CRM.
// ─────────────────────────────────────────────

export const PLANS = {
  WEEKLY: { price: 500, cycle: "WEEKLY", durationDays: 7, name: "Weekly" },
  MONTHLY: { price: 1800, cycle: "MONTHLY", durationDays: 30, name: "Monthly" },
  YEARLY: { price: 18000, cycle: "YEARLY", durationDays: 365, name: "Yearly" },
  LIFETIME: { price: 50000, cycle: "LIFETIME", durationDays: null, name: "Lifetime" },
} as const;

export type PlanKey = keyof typeof PLANS;

export const BillingService = {
  // ── Plans ──
  listPlans() {
    return Object.entries(PLANS).map(([key, plan]) => ({
      key, ...plan, priceDisplay: `৳${plan.price.toLocaleString("en-US")}`,
      ...(plan.cycle !== "LIFETIME" && { period: `/${plan.cycle.toLowerCase().replace("ly", "y")}` }),
      ...(plan.cycle === "LIFETIME" && { period: "one-time" }),
    }));
  },

  // ── Subscription ──
  async getCurrentSubscription(userId: string) {
    return db.subscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
      orderBy: { createdAt: "desc" },
    });
  },

  async createSubscription(userId: string, plan: PlanKey, method: string, payerNumber?: string, payerReference?: string, gatewayId?: string) {
    const planData = PLANS[plan];
    if (!planData) throw new Error("Invalid plan");
    const user = await getCurrentUser();
    const createdBy = user?.id ?? userId;

    return db.$transaction(async (tx) => {
      // Create payment order
      const count = await tx.paymentOrder.count();
      const orderNumber = `INV-${String(count + 1001).padStart(6, "0")}`;
      const amount = toDecimal(planData.price);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24h to pay

      const paymentOrder = await tx.paymentOrder.create({
        data: {
          orderNumber,
          userId,
          plan,
          amount: amount.toNumber(),
          method,
          gatewayId: gatewayId ?? null,
          payerNumber,
          payerReference,
          status: "PENDING",
          expiresAt,
        },
      });

      // Create/extend subscription (TRIALING until payment confirmed)
      const existing = await tx.subscription.findFirst({
        where: { userId, status: { in: ["ACTIVE", "TRIALING"] } },
      });
      let subscription;
      if (existing && existing.plan === plan) {
        subscription = existing;
      } else {
        subscription = await tx.subscription.create({
          data: {
            userId,
            plan,
            status: "TRIALING",
            amount: amount.toNumber(),
            billingCycle: planData.cycle,
            trialEndsAt: expiresAt,
          },
        });
        await tx.paymentOrder.update({ where: { id: paymentOrder.id }, data: { subscriptionId: subscription.id } });
      }

      await AuditService.log({ userId: createdBy, action: "BILLING_SUBSCRIBE", entity: "PaymentOrder", entityId: paymentOrder.id, changes: { plan, amount: amount.toFixed(2), method } }, tx);
      return { paymentOrder, subscription };
    }, { timeout: 20000, maxWait: 10000 });
  },

  // ── Verify/confirm a payment (manual by admin or gateway callback) ──
  async confirmPayment(orderId: string, verifiedBy: string, transactionId?: string, notes?: string) {
    return db.$transaction(async (tx) => {
      const order = await tx.paymentOrder.findUnique({ where: { id: orderId }, include: { subscription: true } });
      if (!order) throw new Error("Payment order not found");
      // Guard: only PENDING orders can be confirmed. Previously this only
      // blocked re-confirming PAID orders, leaving FAILED/CANCELLED/REFUNDED
      // orders re-confirmable — a footgun for gateway callbacks arriving
      // out of order.
      if (order.status !== "PENDING") throw new Error(`Payment cannot be confirmed — current status: ${order.status}`);

      await tx.paymentOrder.update({
        where: { id: orderId },
        data: { status: "PAID", paidAt: new Date(), verifiedBy, transactionId, notes },
      });

      // Activate subscription
      if (order.subscription) {
        const planData = PLANS[order.plan as PlanKey];
        const startDate = new Date();
        let endDate: Date | null = null;
        if (planData.durationDays) {
          endDate = new Date();
          endDate.setDate(endDate.getDate() + planData.durationDays);
        }
        await tx.subscription.update({
          where: { id: order.subscription.id },
          data: { status: "ACTIVE", startDate, endDate, trialEndsAt: null },
        });
      }

      // Add to wallet if method is WALLET — deduct from balance.
      // Previously, when no Wallet row existed for the user, the deduction
      // was silently skipped — the PaymentOrder was still marked PAID and
      // the subscription activated, but no money was actually taken. Now we
      // throw so the transaction rolls back.
      if (order.method === "WALLET") {
        const wallet = await tx.wallet.findUnique({ where: { userId: order.userId } });
        if (!wallet) throw new Error("Wallet not found — cannot pay with WALLET method");
        const balance = toDecimal(wallet.balance);
        const amount = toDecimal(order.amount);
        if (balance.lt(amount)) throw new Error("Insufficient wallet balance");
        const newBalance = balance.minus(amount);
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance.toNumber(), totalSpent: toDecimal(wallet.totalSpent).plus(amount).toNumber() } });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId: order.userId,
            type: "PAYMENT",
            amount: amount.negated().toNumber(),
            balanceAfter: newBalance.toNumber(),
            description: `Subscription payment — ${order.plan}`,
            relatedOrderId: order.id,
            status: "COMPLETED",
          },
        });
      }

      await AuditService.log({ userId: verifiedBy, action: "BILLING_VERIFY", entity: "PaymentOrder", entityId: orderId, changes: { status: "PAID", transactionId } }, tx);
      return { success: true };
    }, { timeout: 20000, maxWait: 10000 });
  },

  // ── Refund a payment ──
  async refundPayment(orderId: string, reason: string) {
    const user = await getCurrentUser();
    return db.$transaction(async (tx) => {
      const order = await tx.paymentOrder.findUnique({ where: { id: orderId }, include: { subscription: true } });
      if (!order || order.status !== "PAID") throw new Error("Only paid orders can be refunded");

      await tx.paymentOrder.update({ where: { id: orderId }, data: { status: "REFUNDED", notes: reason } });
      if (order.subscription) {
        await tx.subscription.update({ where: { id: order.subscription.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      }

      await AuditService.log({ userId: user?.id, action: "BILLING_REFUND", entity: "PaymentOrder", entityId: orderId, changes: { reason } }, tx);
      return { success: true };
    }, { timeout: 20000, maxWait: 10000 });
  },

  // ── List payment orders ──
  async listPayments(opts: { page: number; limit: number; status?: string; userId?: string }) {
    const where: Prisma.PaymentOrderWhereInput = {};
    if (opts.status) where.status = opts.status;
    if (opts.userId) where.userId = opts.userId;
    const [items, total] = await Promise.all([
      db.paymentOrder.findMany({
        where, orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.limit, take: opts.limit,
        include: { user: { select: { name: true, email: true } }, gateway: { select: { name: true, displayName: true } } },
      }),
      db.paymentOrder.count({ where }),
    ]);
    return { items: items.map((p) => ({ ...p, amount: p.amount.toFixed(2) })), total };
  },

  // ── Admin billing dashboard ──
  async adminDashboard() {
    const [totalRevenue, activeSubs, pendingPayments, refundedAmount, mrr, payments] = await Promise.all([
      db.paymentOrder.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
      db.subscription.count({ where: { status: "ACTIVE" } }),
      db.paymentOrder.count({ where: { status: "PENDING" } }),
      db.paymentOrder.aggregate({ where: { status: "REFUNDED" }, _sum: { amount: true } }),
      db.subscription.aggregate({
        where: { status: "ACTIVE", plan: { in: ["WEEKLY", "MONTHLY", "YEARLY"] } },
        _sum: { amount: true },
      }),
      db.paymentOrder.findMany({
        where: { status: { in: ["PAID", "PENDING"] } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);
    // Plan breakdown
    const planBreakdown = await db.subscription.groupBy({
      by: ["plan"],
      where: { status: "ACTIVE" },
      _count: true,
      _sum: { amount: true },
    });
    return {
      totalRevenue: (totalRevenue._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      activeSubscriptions: activeSubs,
      pendingPayments,
      refundedAmount: (refundedAmount._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      mrr: (mrr._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      recentPayments: payments.map((p) => ({ ...p, amount: p.amount.toFixed(2) })),
      planBreakdown: planBreakdown.map((p) => ({ plan: p.plan, count: p._count, revenue: (p._sum.amount ?? new Prisma.Decimal(0)).toFixed(2) })),
    };
  },

  // ── Gateways ──
  async listGateways() {
    const gateways = await db.paymentGateway.findMany({ orderBy: { sortOrder: "asc" } });
    return gateways.map((g) => ({ ...g, config: undefined, hasConfig: !!g.config, merchantNumber: g.merchantNumber }));
  },
  async upsertGateway(id: string | null, data: Partial<{ name: string; displayName: string; type: string; isActive: boolean; config: string; merchantNumber: string; instructions: string; icon: string; sortOrder: number }>) {
    if (id) return db.paymentGateway.update({ where: { id }, data });
    return db.paymentGateway.create({ data: data as any });
  },

  // ── Wallet ──
  async getOrCreateWallet(userId: string) {
    let wallet = await db.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await db.wallet.create({ data: { userId } });
    }
    return wallet;
  },

  async getWalletBalance(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    return { ...wallet, balance: wallet.balance.toFixed(2), totalDeposited: wallet.totalDeposited.toFixed(2), totalWithdrawn: wallet.totalWithdrawn.toFixed(2), totalSpent: wallet.totalSpent.toFixed(2) };
  },

  async walletDeposit(userId: string, amount: number | string, method: string, reference?: string) {
    const user = await getCurrentUser();
    // SECURITY: reject non-positive amounts. A negative amount would
    // silently withdraw from the wallet (reduce balance AND reduce
    // totalDeposited, which is illogical — totalDeposited must be
    // monotonically increasing). A 0 amount is a no-op that would still
    // create a transaction record and inflate counts.
    const amt = toDecimal(amount);
    if (amt.lte(0)) throw new Error("Deposit amount must be greater than zero");
    return db.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) wallet = await tx.wallet.create({ data: { userId } });
      const newBalance = toDecimal(wallet.balance).plus(amt);
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance.toNumber(), totalDeposited: toDecimal(wallet.totalDeposited).plus(amt).toNumber() },
      });
      const txn = await tx.walletTransaction.create({
        data: { walletId: wallet.id, userId, type: "DEPOSIT", amount: amt.toNumber(), balanceAfter: newBalance.toNumber(), method, reference, description: "Wallet deposit", status: "COMPLETED", createdBy: user?.id },
      });
      await AuditService.log({ userId: user?.id, action: "WALLET_DEPOSIT", entity: "WalletTransaction", entityId: txn.id, changes: { amount: amt.toFixed(2), method } }, tx);
      return { ...txn, amount: txn.amount.toFixed(2), balanceAfter: txn.balanceAfter.toFixed(2) };
    }, { timeout: 20000, maxWait: 10000 });
  },

  async walletWithdraw(userId: string, amount: number | string, method: string, reference?: string) {
    const user = await getCurrentUser();
    // SECURITY: reject non-positive amounts. A negative amount would
    // INCREASE the wallet balance (free money) — the previous code's
    // `amt.gt(wallet.balance)` check passes (a negative number is not
    // greater than the balance), then the wallet is updated with
    // balance + |amt| and totalWithdrawn - |amt|, which is nonsensical.
    // A 0 amount is a no-op that would still create a transaction record.
    const amt = toDecimal(amount);
    if (amt.lte(0)) throw new Error("Withdrawal amount must be greater than zero");
    return db.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error("Wallet not found");
      if (amt.gt(toDecimal(wallet.balance))) throw new Error("Insufficient wallet balance");
      const newBalance = toDecimal(wallet.balance).minus(amt);
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance.toNumber(), totalWithdrawn: toDecimal(wallet.totalWithdrawn).plus(amt).toNumber() },
      });
      const txn = await tx.walletTransaction.create({
        data: { walletId: wallet.id, userId, type: "WITHDRAW", amount: amt.negated().toNumber(), balanceAfter: newBalance.toNumber(), method, reference, description: "Wallet withdrawal", status: "COMPLETED", createdBy: user?.id },
      });
      await AuditService.log({ userId: user?.id, action: "WALLET_WITHDRAW", entity: "WalletTransaction", entityId: txn.id, changes: { amount: amt.toFixed(2), method } }, tx);
      return { ...txn, amount: txn.amount.toFixed(2), balanceAfter: txn.balanceAfter.toFixed(2) };
    }, { timeout: 20000, maxWait: 10000 });
  },

  async walletTransactions(userId: string, opts: { page: number; limit: number }) {
    const [items, total] = await Promise.all([
      db.walletTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.limit, take: opts.limit }),
      db.walletTransaction.count({ where: { userId } }),
    ]);
    return { items: items.map((t) => ({ ...t, amount: t.amount.toFixed(2), balanceAfter: t.balanceAfter.toFixed(2) })), total };
  },

  // ── Payouts (Super Admin) ──
  async listPayouts(opts: { page: number; limit: number; status?: string }) {
    const where: Prisma.PayoutRequestWhereInput = {};
    if (opts.status) where.status = opts.status;
    const [items, total] = await Promise.all([
      db.payoutRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.limit, take: opts.limit, include: { payoutAccount: true, requester: { select: { name: true } } } }),
      db.payoutRequest.count({ where }),
    ]);
    return { items: items.map((p) => ({ ...p, amount: p.amount.toFixed(2) })), total };
  },

  async createPayout(data: { amount: number | string; type: string; payoutAccountId?: string; recipientName?: string; recipientAccount?: string; recipientMethod?: string; notes?: string; reference?: string }) {
    const user = await getCurrentUser();
    return db.$transaction(async (tx) => {
      const count = await tx.payoutRequest.count();
      const payoutNumber = `PO-${String(count + 1001).padStart(6, "0")}`;
      const payout = await tx.payoutRequest.create({
        data: {
          payoutNumber,
          amount: toDecimal(data.amount).toNumber(),
          type: data.type,
          payoutAccountId: data.payoutAccountId ?? null,
          recipientName: data.recipientName,
          recipientAccount: data.recipientAccount,
          recipientMethod: data.recipientMethod,
          notes: data.notes,
          reference: data.reference,
          requestedBy: user?.id,
          status: "PENDING",
        },
      });
      await AuditService.log({ userId: user?.id, action: "PAYOUT_CREATE", entity: "PayoutRequest", entityId: payout.id, changes: { amount: data.amount, type: data.type } }, tx);
      return payout;
    }, { timeout: 20000, maxWait: 10000 });
  },

  async approvePayout(id: string) {
    const user = await getCurrentUser();
    return db.$transaction(async (tx) => {
      const payout = await tx.payoutRequest.update({
        where: { id },
        data: { status: "APPROVED", approvedBy: user?.id, approvedAt: new Date() },
      });
      await AuditService.log({ userId: user?.id, action: "PAYOUT_APPROVE", entity: "PayoutRequest", entityId: id, changes: { status: "APPROVED" } }, tx);
      return payout;
    }, { timeout: 20000, maxWait: 10000 });
  },

  async completePayout(id: string, reference?: string) {
    const user = await getCurrentUser();
    return db.$transaction(async (tx) => {
      const payout = await tx.payoutRequest.update({
        where: { id },
        data: { status: "COMPLETED", reference, completedAt: new Date() },
      });
      await AuditService.log({ userId: user?.id, action: "PAYOUT_COMPLETE", entity: "PayoutRequest", entityId: id, changes: { status: "COMPLETED" } }, tx);
      return payout;
    }, { timeout: 20000, maxWait: 10000 });
  },

  async rejectPayout(id: string, reason?: string) {
    const user = await getCurrentUser();
    return db.$transaction(async (tx) => {
      const payout = await tx.payoutRequest.update({
        where: { id },
        data: { status: "REJECTED", notes: reason ?? undefined },
      });
      await AuditService.log({ userId: user?.id, action: "PAYOUT_REJECT", entity: "PayoutRequest", entityId: id, changes: { status: "REJECTED", reason } }, tx);
      return payout;
    }, { timeout: 20000, maxWait: 10000 });
  },

  // ── Payout accounts ──
  async listPayoutAccounts() {
    return db.payoutAccount.findMany({ orderBy: { isDefault: "desc" } });
  },
  async createPayoutAccount(data: { name: string; type: string; accountNumber: string; accountHolder?: string; bankName?: string; branch?: string; routingNumber?: string; notes?: string; isDefault?: boolean }) {
    if (data.isDefault) {
      await db.payoutAccount.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return db.payoutAccount.create({ data });
  },
  async updatePayoutAccount(id: string, data: Partial<{ name: string; type: string; accountNumber: string; accountHolder: string; bankName: string; branch: string; routingNumber: string; notes: string; isActive: boolean; isDefault: boolean }>) {
    if (data.isDefault) {
      await db.payoutAccount.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return db.payoutAccount.update({ where: { id }, data });
  },
  async deletePayoutAccount(id: string) {
    return db.payoutAccount.delete({ where: { id } });
  },
};
