"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowDownRight, ArrowUpRight, DollarSign, ShoppingCart, Wallet, TrendingDown, Package, AlertTriangle, PackageX } from "lucide-react";
import { PageHeader, StatusBadge, StatCard, CardSkeleton } from "../ui";
import { resolveRange } from "@/lib/date-range";

type DashboardData = {
  kpis: {
    today: { sales: string; orders: number; payments: string; expenses: string; profit: string };
    range: { revenue: string; cogs: string; grossProfit: string; operatingExpenses: string; netProfit: string; refunds: string; orderCount: number };
    monthly: { revenue: string; expenses: string; profit: string };
  };
  orderStatus: Record<string, number>;
  paymentStatus: Record<string, number>;
  lowStock: { productId: string; name: string; sku: string; quantity: string; minimum: string }[];
  outOfStock: { productId: string; name: string; sku: string }[];
  trend: { date: string; sales: string; expenses: string; orders: number }[];
  salesByChannel: { name: string; revenue: string; orders: number }[];
  topProducts: { name: string; sku: string; revenue: string; profit: string; quantity: string }[];
  stockValue: { totalCost: string; totalRetail: string; itemCount: number };
};

const COLORS = ["#10b981", "#f59e0b", "#06b6d4", "#8b5cf6", "#ec4899", "#6366f1", "#ef4444"];

export function DashboardView() {
  const { navigate, user } = useCrmStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [preset, setPreset] = useState("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(p: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DashboardData>(`/api/v1/dashboard?preset=${p}`);
      setData(res);
    } catch (e) {
      console.error(e);
      setError((e as Error).message || "Failed to load dashboard data. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(preset); }, [preset]);

  const today = data?.kpis.today;
  const range = data?.kpis.range;
  const monthly = data?.kpis.monthly;

  const trendData = (data?.trend ?? []).map((t) => ({ date: t.date.slice(5), sales: num(t.sales), expenses: num(t.expenses), orders: t.orders }));
  const channelData = (data?.salesByChannel ?? []).map((c) => ({ name: c.name, value: num(c.revenue), orders: c.orders }));
  const topData = (data?.topProducts ?? []).slice(0, 6).map((p) => ({ name: p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name, revenue: num(p.revenue), profit: num(p.profit) }));

  const kpis = [
    { label: "Today's Sales", value: money(today?.sales), icon: DollarSign, delta: null, color: "text-emerald-600" },
    { label: "Today's Orders", value: today?.orders ?? 0, icon: ShoppingCart, delta: null, color: "text-blue-600" },
    { label: "Today's Payments", value: money(today?.payments), icon: Wallet, delta: null, color: "text-cyan-600" },
    { label: "Today's Profit", value: money(today?.profit), icon: ArrowUpRight, delta: null, color: "text-emerald-600" },
  ];

  const profitColor = (n: number) => (n >= 0 ? "text-emerald-600" : "text-red-600");

  // Initial load — show skeletons instead of a flash of "৳0.00" everywhere,
  // which can misread as "you have no sales" for a split second.
  if (loading && !data && !error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Welcome back, ${user?.name?.split(" ")[0] ?? "User"}`}
          description="Business overview with the same accounting engine used by all reports."
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} lines={2} />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} lines={5} />)}
        </div>
      </div>
    );
  }

  // Error state — show a retry UI instead of misleading "৳0.00" everywhere.
  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Welcome back, ${user?.name?.split(" ")[0] ?? "User"}`}
          description="Business overview with the same accounting engine used by all reports."
          action={
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this_week">This week</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
                <SelectItem value="this_year">This year</SelectItem>
              </SelectContent>
            </Select>
          }
        />
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center gap-3">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <p className="text-sm font-medium">Couldn't load dashboard data</p>
            <p className="text-xs text-muted-foreground max-w-md text-center">{error}</p>
            <Button variant="outline" size="sm" onClick={() => load(preset)}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0] ?? "User"}`}
        description="Business overview with the same accounting engine used by all reports."
        action={
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_week">This week</SelectItem>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="this_year">This year</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Today's KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Today's Sales" value={money(today?.sales)} icon={DollarSign} tone="emerald" sub="Gross order value" />
        <StatCard label="Today's Orders" value={today?.orders ?? 0} icon={ShoppingCart} tone="blue" sub="New & confirmed" />
        <StatCard label="Today's Payments" value={money(today?.payments)} icon={Wallet} tone="cyan" sub="Cash + digital" />
        <StatCard label="Today's Profit" value={money(today?.profit)} icon={ArrowUpRight} tone={num(today?.profit) >= 0 ? "emerald" : "red"} sub="Revenue − COGS − costs" />
      </div>

      {/* P&L summary */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 shadow-soft card-hover">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold tracking-tight">Profit &amp; Loss Summary <span className="text-muted-foreground font-normal text-xs">· selected range</span></CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-sm">
              <PnlRow label="Revenue" value={money(range?.revenue)} />
              <PnlRow label="COGS" value={money(range?.cogs)} negative />
              <PnlRow label="Gross Profit" value={money(range?.grossProfit)} color={profitColor(num(range?.grossProfit))} />
              <PnlRow label="Operating Expenses" value={money(range?.operatingExpenses)} negative />
              <PnlRow label="Refunds" value={money(range?.refunds)} negative />
              <PnlRow label="Net Profit" value={money(range?.netProfit)} color={profitColor(num(range?.netProfit))} highlight />
              <PnlRow label="Orders" value={range?.orderCount ?? 0} />
              <PnlRow label="Stock Value (cost)" value={money(data?.stockValue?.totalCost)} />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft card-hover">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold tracking-tight">Monthly Snapshot</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center"><span className="text-muted-foreground">Revenue</span><span className="font-semibold tabular-nums">{money(monthly?.revenue)}</span></div>
            <div className="flex justify-between items-center"><span className="text-muted-foreground">Expenses</span><span className="font-semibold tabular-nums">{money(monthly?.expenses)}</span></div>
            <div className="flex justify-between items-center border-t border-border/60 pt-2.5"><span className="font-medium">Net Profit</span><span className={`font-bold tabular-nums ${profitColor(num(monthly?.profit))}`}>{money(monthly?.profit)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="card-hover shadow-soft">
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold tracking-tight">Sales &amp; Expense Trend <span className="text-muted-foreground font-normal text-xs">· 30 days</span></CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="salesG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip formatter={(v: number) => money(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-md)", fontSize: 12 }} />
                <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2.5} fill="url(#salesG)" name="Sales" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} fill="url(#expG)" name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-base">Sales by Channel</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={48} paddingAngle={3} label={(e) => e.name}>
                  {channelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
                </Pie>
                <Tooltip formatter={(v: number) => money(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-md)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-base">Top Products</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topData} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => money(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-md)", fontSize: 12 }} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[0, 4, 4, 0]} maxBarSize={22} />
                <Bar dataKey="profit" fill="#06b6d4" name="Profit" radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-base">Order Status</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(data?.orderStatus ?? {}).filter(([, v]) => v > 0).map(([s, v]) => (
              <button key={s} onClick={() => navigate("orders", { status: s })} className="rounded-lg border border-border/60 p-3 hover:bg-accent hover:border-primary/30 text-left transition-all card-hover">
                <StatusBadge status={s} />
                <div className="mt-1.5 text-2xl font-bold tabular-nums">{v}</div>
              </button>
            ))}
            {Object.values(data?.orderStatus ?? {}).every((v) => v === 0) && <div className="col-span-full text-sm text-muted-foreground py-8 text-center">No orders in this period</div>}
          </CardContent>
        </Card>
      </div>

      {/* Stock alerts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="shadow-soft card-hover">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Low Stock ({data?.lowStock?.length ?? 0})</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("inventory", { status: "low" })}>View all</Button>
          </CardHeader>
          <CardContent>
            {(data?.lowStock ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">All products are well stocked</div>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {(data?.lowStock ?? []).map((p) => (
                  <button key={p.productId} onClick={() => navigate("inventory")} className="w-full flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-accent">
                    <span className="truncate">{p.name} <span className="text-xs text-muted-foreground">{p.sku}</span></span>
                    <span className="text-amber-600 font-medium">{p.quantity} / {p.minimum}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-soft card-hover">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><PackageX className="h-4 w-4 text-red-500" /> Out of Stock ({data?.outOfStock?.length ?? 0})</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("inventory", { status: "out" })}>View all</Button>
          </CardHeader>
          <CardContent>
            {(data?.outOfStock ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No out-of-stock products</div>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {(data?.outOfStock ?? []).map((p) => (
                  <button key={p.productId} onClick={() => navigate("purchases")} className="w-full flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-accent">
                    <span className="truncate">{p.name} <span className="text-xs text-muted-foreground">{p.sku}</span></span>
                    <span className="text-red-600 font-medium">0 units</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PnlRow({ label, value, negative, color, highlight }: { label: string; value: string | number; negative?: boolean; color?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md p-2 ${highlight ? "bg-primary/10" : "bg-muted/30"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold ${color ?? ""} ${negative ? "text-red-600" : ""}`}>{value}</div>
    </div>
  );
}

void resolveRange; void Package; void TrendingDown; void ArrowDownRight;
