"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, PageHeader, StatCard } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";
import { Wallet, CreditCard, TrendingUp, Calendar, Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";

export function BillingView() {
  const { navigate, user } = useCrmStore();
  const [sub, setSub] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [s, w, p] = await Promise.all([
          api.get<any>("/api/v1/billing/subscription").catch(() => null),
          api.get<any>("/api/v1/billing/wallet").catch(() => null),
          api.get<{ items: any[] }>("/api/v1/billing/payments?limit=10").catch(() => ({ items: [] })),
        ]);
        if (cancelled) return;
        setSub(s); setWallet(w); setPayments(p.items);
      } catch (e) { toast.error((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <PageHeader title="Billing & Subscription" description="Manage your Z-CRM subscription, wallet, and payment history." action={
        <Button onClick={() => navigate("billing/checkout")}><Plus className="h-4 w-4 mr-1" /> Subscribe / Renew</Button>
      } />

      {/* Current subscription */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="shadow-soft card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Current Plan</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {sub ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-bold text-lg gradient-text">{sub.plan}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={sub.status} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium">{money(sub.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span><span className="text-xs">{formatDate(sub.startDate)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">End Date</span><span className="text-xs">{sub.endDate ? formatDate(sub.endDate) : "Lifetime ♾️"}</span></div>
                {sub.status === "TRIALING" && <div className="mt-2 p-2 rounded-lg bg-amber-500/10 text-amber-700 text-xs">⏳ Trial — complete your payment to activate</div>}
                {sub.status === "ACTIVE" && <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-700 text-xs">✅ Active — full access to all features</div>}
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-3">No active subscription</p>
                <Button size="sm" onClick={() => navigate("billing/checkout")}>Choose a Plan</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft card-hover">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Wallet</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("billing/wallet")}>Manage</Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span className="font-bold text-lg tabular-nums">{money(wallet?.balance ?? "0")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Deposited</span><span className="text-xs">{money(wallet?.totalDeposited ?? "0")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Withdrawn</span><span className="text-xs">{money(wallet?.totalWithdrawn ?? "0")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Spent</span><span className="text-xs">{money(wallet?.totalSpent ?? "0")}</span></div>
          </CardContent>
        </Card>

        <Card className="shadow-soft card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Quick Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("billing/checkout")}><CreditCard className="h-3.5 w-3.5 mr-2" /> Subscribe / Renew</Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("billing/wallet")}><Wallet className="h-3.5 w-3.5 mr-2" /> Deposit / Withdraw</Button>
            {/* Admin Billing Panel — only visible to SUPER_ADMIN and ADMIN.
                Other roles would see a 403 / empty page on click (the API
                enforces billing:manage_payouts), so hide the button to
                avoid confusing non-admin users. */}
            {(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && (
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("billing/admin")}><TrendingUp className="h-3.5 w-3.5 mr-2" /> Admin Billing Panel</Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment history */}
      <Card className="shadow-soft">
        <CardHeader className="pb-2"><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payments yet.</p>
          ) : (
            <div className="rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Invoice</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Plan</th><th className="text-right font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Amount</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Method</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Status</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Date</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-border/60 hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{p.orderNumber}</td>
                      <td className="px-4 py-3">{p.plan}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{money(p.amount)}</td>
                      <td className="px-4 py-3">{p.method}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Checkout Flow ───
export function BillingCheckoutView() {
  const { navigate, params } = useCrmStore();
  const [plans, setPlans] = useState<any[]>([]);
  const [gateways, setGateways] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [method, setMethod] = useState("BKASH");
  const [payerNumber, setPayerNumber] = useState("");
  const [payerReference, setPayerReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [p, g] = await Promise.all([
          api.get<{ items: any[] }>("/api/v1/billing/plans"),
          api.get<{ items: any[] }>("/api/v1/billing/gateways"),
        ]);
        if (cancelled) return;
        setPlans(p.items);
        setGateways(g.items.filter((gw: any) => gw.isActive));
        // Pre-select the plan passed via navigation params (e.g. when the
        // user clicked "Start Yearly" on the landing page → registered →
        // was redirected here with plan=YEARLY). Fall back to Monthly
        // (the second plan) only if no plan was specified.
        const requestedPlan = (params?.plan as string | undefined)?.toUpperCase();
        const valid = ["WEEKLY", "MONTHLY", "YEARLY", "LIFETIME"];
        if (requestedPlan && valid.includes(requestedPlan)) {
          setSelectedPlan(requestedPlan);
        } else if (p.items[1]) {
          setSelectedPlan(p.items[1].key); // default to Monthly
        } else if (p.items[0]) {
          setSelectedPlan(p.items[0].key);
        }
      } catch (e) { toast.error((e as Error).message); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  async function subscribe() {
    if (!selectedPlan) { toast.error("Select a plan"); return; }
    setSubmitting(true);
    try {
      const result = await api.post<{ paymentOrder: any }>("/api/v1/billing/subscribe", { plan: selectedPlan, method, payerNumber, payerReference });
      toast.success("Subscription created! Complete your payment to activate.");
      navigate("billing");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSubmitting(false); }
  }

  const selectedPlanData = plans.find((p) => p.key === selectedPlan);

  return (
    <div>
      <PageHeader title="Choose Your Plan" description="Select a plan and payment method to subscribe to Z-CRM." />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Plan selection */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {plans.map((p) => (
              <button key={p.key} onClick={() => setSelectedPlan(p.key)} className={`rounded-xl border p-4 text-left transition-all ${selectedPlan === p.key ? "border-primary/40 shadow-glow ring-1 ring-primary/20 bg-primary/5" : "border-border/60 hover:bg-accent"}`}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{p.name}</p>
                <p className="text-2xl font-bold mt-1 gradient-text">{p.priceDisplay}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.period}</p>
              </button>
            ))}
          </div>

          {/* Payment method */}
          <Card className="shadow-soft">
            <CardHeader className="pb-2"><CardTitle className="text-base">Payment Method</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {gateways.map((g) => (
                  <button key={g.name} onClick={() => setMethod(g.name)} className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${method === g.name ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "border-border/60 hover:bg-accent"}`}>
                    {g.displayName}
                  </button>
                ))}
              </div>
              {(method === "BKASH" || method === "NAGAD") && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div><label className="text-xs font-medium">Your {method === "BKASH" ? "bKash" : "Nagad"} Number</label><input className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={payerNumber} onChange={(e) => setPayerNumber(e.target.value)} placeholder="01XXXXXXXXX" /></div>
                  <div><label className="text-xs font-medium">Transaction ID / Reference</label><input className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={payerReference} onChange={(e) => setPayerReference(e.target.value)} placeholder="TrxID" /></div>
                </div>
              )}
              {method === "BANK" && (
                <div className="pt-2"><label className="text-xs font-medium">Bank Reference / Cheque No.</label><input className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={payerReference} onChange={(e) => setPayerReference(e.target.value)} /></div>
              )}
              {method === "WALLET" && (
                <p className="text-xs text-muted-foreground pt-2">Payment will be deducted from your wallet balance automatically.</p>
              )}
              {method === "MANUAL" && (
                <p className="text-xs text-muted-foreground pt-2">Admin will verify and confirm your payment manually.</p>
              )}
            </CardContent>
          </Card>

          <Button size="lg" className="w-full" onClick={subscribe} disabled={submitting || !selectedPlan}>
            {submitting ? "Processing…" : `Subscribe — ${selectedPlanData?.priceDisplay ?? ""} ${selectedPlanData?.period ?? ""}`}
          </Button>
        </div>

        {/* Summary */}
        <Card className="shadow-soft">
          <CardHeader className="pb-2"><CardTitle className="text-base">Order Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-medium">{selectedPlanData?.name ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Billing Cycle</span><span className="text-xs">{selectedPlanData?.cycle ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span className="text-xs">{selectedPlanData?.durationDays ? `${selectedPlanData.durationDays} days` : "Lifetime"}</span></div>
            <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span className="gradient-text text-lg">{selectedPlanData?.priceDisplay ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment Method</span><span className="text-xs">{method}</span></div>
            <p className="text-xs text-muted-foreground pt-3 border-t">After payment, your subscription will be activated. For bKash/Nagad, enter your number + transaction ID. Admin verifies manual payments.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Wallet View ───
export function BillingWalletView() {
  const { navigate } = useCrmStore();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BKASH");
  const [ref, setRef] = useState("");
  const [processing, setProcessing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [w, t] = await Promise.all([
        api.get<any>("/api/v1/billing/wallet"),
        api.get<{ items: any[] }>("/api/v1/billing/wallet/transactions?limit=20"),
      ]);
      setWallet(w); setTransactions(t.items);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => { if (!cancelled) await load(); };
    doLoad();
    return () => { cancelled = true; };
  }, []);

  async function deposit() {
    if (!amount || Number(amount) <= 0) { toast.error("Enter amount"); return; }
    setProcessing(true);
    try {
      await api.post("/api/v1/billing/wallet/deposit", { amount, method, reference: ref });
      toast.success("Deposit successful");
      setDepositOpen(false); setAmount(""); setRef("");
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setProcessing(false); }
  }
  async function withdraw() {
    if (!amount || Number(amount) <= 0) { toast.error("Enter amount"); return; }
    setProcessing(true);
    try {
      await api.post("/api/v1/billing/wallet/withdraw", { amount, method, reference: ref });
      toast.success("Withdrawal successful");
      setWithdrawOpen(false); setAmount(""); setRef("");
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setProcessing(false); }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader title="Wallet" description="Deposit, withdraw, and view your wallet transaction history." action={
        <Button variant="ghost" size="sm" onClick={() => navigate("billing")}>Back to Billing</Button>
      } />
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Current Balance" value={money(wallet?.balance ?? "0")} icon={Wallet} tone="primary" />
        <StatCard label="Total Deposited" value={money(wallet?.totalDeposited ?? "0")} icon={ArrowUpRight} tone="emerald" />
        <StatCard label="Total Withdrawn" value={money(wallet?.totalWithdrawn ?? "0")} icon={ArrowDownRight} tone="amber" />
      </div>
      <div className="flex gap-2 mb-4">
        <Button onClick={() => { setDepositOpen(!depositOpen); setWithdrawOpen(false); }}><Plus className="h-4 w-4 mr-1" /> Deposit</Button>
        <Button variant="outline" onClick={() => { setWithdrawOpen(!withdrawOpen); setDepositOpen(false); }}><ArrowUpRight className="h-4 w-4 mr-1" /> Withdraw</Button>
      </div>
      {depositOpen && (
        <Card className="mb-4 shadow-soft"><CardContent className="p-4 space-y-3">
          <h3 className="font-semibold">Deposit to Wallet</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium">Amount (৳)</label><input type="number" className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" /></div>
            <div><label className="text-xs font-medium">Method</label><select className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={method} onChange={(e) => setMethod(e.target.value)}><option value="BKASH">bKash</option><option value="NAGAD">Nagad</option><option value="BANK">Bank</option><option value="CASH">Cash</option><option value="MANUAL">Manual</option></select></div>
          </div>
          <div><label className="text-xs font-medium">Reference / TrxID</label><input className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={ref} onChange={(e) => setRef(e.target.value)} /></div>
          <Button onClick={deposit} disabled={processing}>{processing ? "Processing…" : "Deposit"}</Button>
        </CardContent></Card>
      )}
      {withdrawOpen && (
        <Card className="mb-4 shadow-soft"><CardContent className="p-4 space-y-3">
          <h3 className="font-semibold">Withdraw from Wallet</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium">Amount (৳)</label><input type="number" className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" /></div>
            <div><label className="text-xs font-medium">Method</label><select className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={method} onChange={(e) => setMethod(e.target.value)}><option value="BKASH">bKash</option><option value="NAGAD">Nagad</option><option value="BANK">Bank</option><option value="CASH">Cash</option></select></div>
          </div>
          <div><label className="text-xs font-medium">Reference / Account No.</label><input className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={ref} onChange={(e) => setRef(e.target.value)} /></div>
          <Button onClick={withdraw} disabled={processing}>{processing ? "Processing…" : "Withdraw"}</Button>
        </CardContent></Card>
      )}
      <Card className="shadow-soft">
        <CardHeader className="pb-2"><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40"><tr><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Type</th><th className="text-right font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Amount</th><th className="text-right font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Balance After</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Method</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Date</th></tr></thead>
              <tbody>
                {transactions.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No transactions yet</td></tr> :
                transactions.map((t) => (
                  <tr key={t.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="px-4 py-3"><StatusBadge status={t.type} /></td>
                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${num(t.amount) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{num(t.amount) >= 0 ? "+" : ""}{money(Math.abs(num(t.amount)).toFixed(2))}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(t.balanceAfter)}</td>
                    <td className="px-4 py-3 text-xs">{t.method ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Super Admin Billing Panel ───
export function BillingAdminView() {
  const { navigate } = useCrmStore();
  const [dash, setDash] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [pf, setPf] = useState({ amount: "", type: "PAYOUT", recipientName: "", recipientAccount: "", recipientMethod: "BKASH", notes: "" });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [d, p] = await Promise.all([
          api.get<any>("/api/v1/billing/admin/dashboard").catch(() => null),
          api.get<{ items: any[] }>("/api/v1/billing/admin/payouts?limit=10").catch(() => ({ items: [] })),
        ]);
        if (cancelled) return;
        setDash(d); setPayouts(p.items);
      } catch (e) { toast.error((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  async function createPayout() {
    if (!pf.amount) { toast.error("Enter amount"); return; }
    try {
      await api.post("/api/v1/billing/admin/payouts", { ...pf, amount: Number(pf.amount) });
      toast.success("Payout created");
      setPayoutOpen(false); setPf({ amount: "", type: "PAYOUT", recipientName: "", recipientAccount: "", recipientMethod: "BKASH", notes: "" });
      // reload
      const p = await api.get<{ items: any[] }>("/api/v1/billing/admin/payouts?limit=10");
      setPayouts(p.items);
    } catch (e) { toast.error((e as Error).message); }
  }
  async function payoutAction(id: string, action: "approve" | "complete" | "reject") {
    try {
      await api.post(`/api/v1/billing/admin/payouts/${id}/${action}`);
      toast.success(`Payout ${action}d`);
      const p = await api.get<{ items: any[] }>("/api/v1/billing/admin/payouts?limit=10");
      setPayouts(p.items);
    } catch (e) { toast.error((e as Error).message); }
  }
  async function confirmPayment(orderId: string) {
    try {
      await api.post(`/api/v1/billing/payments/${orderId}/confirm`, {});
      toast.success("Payment confirmed");
      const d = await api.get<any>("/api/v1/billing/admin/dashboard");
      setDash(d);
    } catch (e) { toast.error((e as Error).message); }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading admin billing…</div>;

  return (
    <div>
      <PageHeader title="Billing Admin Panel" description="Revenue, subscriptions, payment verification, and payout management." breadcrumb="Super Admin" action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPayoutOpen(!payoutOpen)}><Plus className="h-4 w-4 mr-1" /> New Payout</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("billing")}>Customer Billing</Button>
        </div>
      } />

      {dash && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Total Revenue" value={money(dash.totalRevenue)} icon={TrendingUp} tone="emerald" />
            <StatCard label="Active Subscriptions" value={String(dash.activeSubscriptions)} icon={CreditCard} tone="blue" />
            <StatCard label="Pending Payments" value={String(dash.pendingPayments)} icon={Calendar} tone="amber" />
            <StatCard label="Refunded" value={money(dash.refundedAmount)} icon={ArrowDownRight} tone="red" />
          </div>

          {/* Plan breakdown */}
          {dash.planBreakdown?.length > 0 && (
            <Card className="mb-6 shadow-soft">
              <CardHeader className="pb-2"><CardTitle className="text-base">Active Subscriptions by Plan</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {dash.planBreakdown.map((p: any) => (
                    <div key={p.plan} className="rounded-lg border border-border/60 p-3"><div className="text-xs text-muted-foreground uppercase tracking-wider">{p.plan}</div><div className="text-2xl font-bold mt-1">{p.count}</div><div className="text-xs text-muted-foreground">{money(p.revenue)}</div></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent payments */}
          <Card className="mb-6 shadow-soft">
            <CardHeader className="pb-2"><CardTitle className="text-base">Recent Payments</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40"><tr><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Invoice</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Customer</th><th className="text-right font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Amount</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Plan</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Method</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Status</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Actions</th></tr></thead>
                  <tbody>
                    {dash.recentPayments?.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No payments yet</td></tr> :
                    dash.recentPayments.map((p: any) => (
                      <tr key={p.id} className="border-t border-border/60 hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">{p.orderNumber}</td>
                        <td className="px-4 py-3">{p.user?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">{money(p.amount)}</td>
                        <td className="px-4 py-3">{p.plan}</td>
                        <td className="px-4 py-3 text-xs">{p.method}</td>
                        <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                        <td className="px-4 py-3">{p.status === "PENDING" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => confirmPayment(p.id)}>Verify</Button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Payouts */}
      <Card className="shadow-soft">
        <CardHeader className="pb-2"><CardTitle className="text-base">Payout Requests</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40"><tr><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Number</th><th className="text-right font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Amount</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Type</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Recipient</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Status</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Date</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Actions</th></tr></thead>
              <tbody>
                {payouts.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No payouts yet</td></tr> :
                payouts.map((p) => (
                  <tr key={p.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{p.payoutNumber}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{money(p.amount)}</td>
                    <td className="px-4 py-3">{p.type}</td>
                    <td className="px-4 py-3 text-xs">{p.recipientName ?? "—"} {p.recipientAccount ?? ""}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      {p.status === "PENDING" && <><Button size="sm" variant="outline" className="h-7 text-xs mr-1" onClick={() => payoutAction(p.id, "approve")}>Approve</Button><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => payoutAction(p.id, "reject")}>Reject</Button></>}
                      {p.status === "APPROVED" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => payoutAction(p.id, "complete")}>Mark Sent</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payout form */}
      {payoutOpen && (
        <Card className="mt-4 shadow-soft"><CardContent className="p-4 space-y-3">
          <h3 className="font-semibold">Send Money / Create Payout</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium">Amount (৳)</label><input type="number" className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={pf.amount} onChange={(e) => setPf({ ...pf, amount: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Type</label><select className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={pf.type} onChange={(e) => setPf({ ...pf, type: e.target.value })}><option value="PAYOUT">Payout</option><option value="SALARY">Salary</option><option value="EXPENSE">Expense</option><option value="TRANSFER">Transfer</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium">Recipient Name</label><input className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={pf.recipientName} onChange={(e) => setPf({ ...pf, recipientName: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Recipient Account / Number</label><input className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={pf.recipientAccount} onChange={(e) => setPf({ ...pf, recipientAccount: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium">Method</label><select className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={pf.recipientMethod} onChange={(e) => setPf({ ...pf, recipientMethod: e.target.value })}><option value="BKASH">bKash</option><option value="NAGAD">Nagad</option><option value="BANK">Bank</option><option value="CASH">Cash</option></select></div>
            <div><label className="text-xs font-medium">Notes</label><input className="w-full rounded-lg border border-border px-3 h-9 text-sm mt-1" value={pf.notes} onChange={(e) => setPf({ ...pf, notes: e.target.value })} /></div>
          </div>
          <Button onClick={createPayout}>Create Payout</Button>
        </CardContent></Card>
      )}
    </div>
  );
}
