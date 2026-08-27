"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore, type RouteKey } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, PieChart, Pie, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Download } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

const COLORS = ["#10b981", "#f59e0b", "#06b6d4", "#8b5cf6", "#ec4899", "#6366f1", "#ef4444"];
const PRESETS = [
  { value: "today", label: "Today" }, { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" }, { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" }, { value: "this_year", label: "This year" },
];

export function ReportsView({ type }: { type: "sales" | "payments" | "expenses" | "inventory" | "products" | "customers" | "channels" | "cash-flow" | "suppliers" | "dues" }) {
  const { navigate } = useCrmStore();
  const [preset, setPreset] = useState("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from && to) { params.set("from", from); params.set("to", to); }
      else params.set("preset", preset);
      const r = await api.get<any>(`/api/v1/reports/${type}?${params}`);
      setData(r);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [type, preset, from, to]);

  const tabs: { key: RouteKey; label: string }[] = [
    { key: "reports/sales", label: "Sales" },
    { key: "reports/payments", label: "Payments" },
    { key: "reports/expenses", label: "Expenses" },
    { key: "reports/inventory", label: "Inventory" },
    { key: "reports/products", label: "Products" },
    { key: "reports/customers", label: "Customers" },
    { key: "reports/channels", label: "Channels" },
    { key: "reports/cash-flow", label: "Cash Flow" },
    { key: "reports/suppliers", label: "Suppliers" },
    { key: "reports/dues", label: "Dues" },
  ];

  return (
    <div>
      <PageHeader title={`${type[0].toUpperCase() + type.slice(1)} Report`} description="Every report supports date filtering and shares the centralized accounting engine." />

      <div className="flex flex-wrap gap-1 mb-4 border-b">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => navigate(t.key)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${`reports/${type}` === t.key.replace("reports/", "reports/") ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t.label}</button>
        ))}
      </div>

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap items-end gap-3">
          <div><Label className="text-xs">Preset</Label>
            <Select value={preset} onValueChange={setPreset}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">— or —</div>
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        </CardContent>
      </Card>

      {loading ? <div className="py-8 text-center text-muted-foreground">Loading…</div> : (
        <ReportContent type={type} data={data} />
      )}
    </div>
  );
}

function ReportContent({ type, data }: { type: string; data: any }) {
  if (!data) return null;

  if (type === "sales") {
    const channelData = (data.byChannel ?? []).map((c: any) => ({ name: c.name, revenue: num(c.revenue), orders: c.orders }));
    const topData = (data.topProducts ?? []).slice(0, 8).map((p: any) => ({ name: p.name?.slice(0, 16), revenue: num(p.revenue), profit: num(p.profit) }));
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Orders" value={String(data.orderCount)} />
          <KPI label="Gross Sales" value={money(data.grossSales)} />
          <KPI label="Discounts" value={money(data.discounts)} />
          <KPI label="Net Sales" value={money(data.netSales)} />
          <KPI label="Total" value={money(data.total)} />
          <KPI label="Avg Order Value" value={money(data.averageOrderValue)} />
        </div>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Sales by Channel</CardTitle></CardHeader>
          <CardContent><ResponsiveContainer width="100%" height={280}><BarChart data={channelData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v: number) => money(v)} /><Bar dataKey="revenue" fill="#10b981" /></BarChart></ResponsiveContainer></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Top Products</CardTitle></CardHeader>
          <CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={topData} layout="vertical" margin={{ left: 40 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} /><Tooltip formatter={(v: number) => money(v)} /><Legend /><Bar dataKey="revenue" fill="#10b981" /><Bar dataKey="profit" fill="#06b6d4" /></BarChart></ResponsiveContainer></CardContent>
        </Card>
      </div>
    );
  }

  if (type === "payments") {
    const methodData = (data.byMethod ?? []).map((m: any) => ({ name: m.method, value: num(m.total) }));
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPI label="Total Paid" value={money(data.totalPaid)} />
          <KPI label="Payment Count" value={String(data.paymentCount)} />
          <KPI label="Outstanding" value={money(data.outstandingTotal)} />
          <KPI label="Unpaid Orders" value={String(data.unpaidOrdersCount)} />
        </div>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Payments by Method</CardTitle></CardHeader>
          <CardContent><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={methodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>{methodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => money(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Unpaid Orders</CardTitle></CardHeader><CardContent>
          <DataTable rows={(data.unpaidOrders ?? []).map((o: any) => ({ id: o.id, ...o }))} loading={false} page={1} totalPages={1} total={data.unpaidOrders?.length ?? 0} limit={20} columns={[
            { key: "order", header: "Order", render: (r: any) => r.orderNumber },
            { key: "customer", header: "Customer", render: (r: any) => r.customer?.name },
            { key: "total", header: "Total", render: (r: any) => money(r.total) },
            { key: "paid", header: "Paid", render: (r: any) => money(r.paid) },
            { key: "outstanding", header: "Outstanding", render: (r: any) => <span className="text-amber-600 font-medium">{money(r.outstanding)}</span> },
            { key: "status", header: "Status", render: (r: any) => <StatusBadge status={r.paymentStatus} /> },
          ]} />
        </CardContent></Card>
      </div>
    );
  }

  if (type === "expenses") {
    const catData = (data.byCategory ?? []).map((c: any) => ({ name: c.category, value: num(c.total) }));
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPI label="Total Expenses" value={money(data.total)} />
          <KPI label="Count" value={String(data.count)} />
        </div>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Expenses by Category</CardTitle></CardHeader>
          <CardContent><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>{catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => money(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Expense List</CardTitle></CardHeader><CardContent>
          <DataTable rows={(data.expenses ?? []).map((e: any) => ({ id: e.id, ...e }))} loading={false} page={1} totalPages={1} total={data.expenses?.length ?? 0} limit={20} columns={[
            { key: "date", header: "Date", render: (r: any) => formatDate(r.expenseDate) },
            { key: "category", header: "Category", render: (r: any) => r.category },
            { key: "amount", header: "Amount", render: (r: any) => money(r.amount) },
            { key: "method", header: "Method", render: (r: any) => r.method },
            { key: "desc", header: "Description", render: (r: any) => r.description || "—" },
          ]} />
        </CardContent></Card>
      </div>
    );
  }

  if (type === "inventory") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPI label="Total Stock Value (cost)" value={money(data.totalCostValue)} />
          <KPI label="Total Retail Value" value={money(data.totalRetailValue)} />
          <KPI label="Items" value={String(data.itemCount)} />
          <KPI label="Low Stock" value={String(data.lowStock?.length ?? 0)} />
          <KPI label="Out of Stock" value={String(data.outOfStock?.length ?? 0)} />
        </div>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Stock Valuation</CardTitle></CardHeader><CardContent>
          <DataTable rows={(data.items ?? []).map((i: any) => ({ id: i.productId, ...i }))} loading={false} page={1} totalPages={1} total={data.items?.length ?? 0} limit={20} columns={[
            { key: "name", header: "Product", render: (r: any) => r.name },
            { key: "sku", header: "SKU", render: (r: any) => r.sku },
            { key: "qty", header: "Quantity", render: (r: any) => r.quantity },
            { key: "cost", header: "Cost Value", render: (r: any) => money(r.costValue) },
            { key: "retail", header: "Retail Value", render: (r: any) => money(r.retailValue) },
          ]} />
        </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Recent Stock Movements</CardTitle></CardHeader><CardContent>
          <DataTable rows={(data.movements ?? []).map((m: any) => ({ id: m.id, ...m }))} loading={false} page={1} totalPages={1} total={data.movements?.length ?? 0} limit={20} columns={[
            { key: "date", header: "Date", render: (r: any) => formatDate(r.createdAt) },
            { key: "type", header: "Type", render: (r: any) => <StatusBadge status={r.type} /> },
            { key: "product", header: "Product", render: (r: any) => r.product?.name },
            { key: "change", header: "Change", render: (r: any) => <span className={num(r.quantityChange) >= 0 ? "text-emerald-600" : "text-red-600"}>{num(r.quantityChange) >= 0 ? "+" : ""}{r.quantityChange}</span> },
            { key: "prev", header: "Prev", render: (r: any) => r.previousQuantity },
            { key: "new", header: "New", render: (r: any) => r.newQuantity },
            { key: "user", header: "By", render: (r: any) => r.createdBy || "—" },
          ]} />
        </CardContent></Card>
      </div>
    );
  }

  if (type === "products") {
    return (
      <Card><CardContent className="p-3">
        <DataTable rows={(data.items ?? []).map((i: any) => ({ id: i.productId, ...i }))} loading={false} page={1} totalPages={1} total={data.items?.length ?? 0} limit={50} columns={[
          { key: "name", header: "Product", render: (r: any) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.sku}</div></div> },
          { key: "qty", header: "Qty Sold", render: (r: any) => r.quantity },
          { key: "revenue", header: "Revenue", render: (r: any) => money(r.revenue) },
          { key: "cogs", header: "COGS", render: (r: any) => money(r.cogs) },
          { key: "profit", header: "Profit", render: (r: any) => <span className={num(r.profit) >= 0 ? "text-emerald-600" : "text-red-600"}>{money(r.profit)}</span> },
        ]} />
      </CardContent></Card>
    );
  }

  if (type === "customers") {
    return (
      <Card><CardContent className="p-3">
        <DataTable rows={(data.items ?? []).map((i: any) => ({ id: i.id, ...i }))} loading={false} page={1} totalPages={1} total={data.items?.length ?? 0} limit={50} columns={[
          { key: "name", header: "Customer", render: (r: any) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.phone}</div></div> },
          { key: "city", header: "City", render: (r: any) => r.city || "—" },
          { key: "orders", header: "Orders", render: (r: any) => r.orderCount },
          { key: "spending", header: "Spending", render: (r: any) => money(r.totalSpending) },
          { key: "paid", header: "Paid", render: (r: any) => money(r.totalPaid) },
          { key: "outstanding", header: "Outstanding", render: (r: any) => <span className={num(r.outstanding) > 0 ? "text-amber-600" : ""}>{money(r.outstanding)}</span> },
        ]} />
      </CardContent></Card>
    );
  }

  if (type === "channels") {
    const items = data.items ?? [];
    const totalRevenue = items.reduce((s: number, i: any) => s + num(i.revenue), 0);
    const totalProfit = items.reduce((s: number, i: any) => s + num(i.profit), 0);
    const channelData = items.map((i: any) => ({ name: i.name, revenue: num(i.revenue), profit: num(i.profit) }));
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPI label="Total Revenue" value={money(String(totalRevenue))} />
          <KPI label="Total Profit" value={money(String(totalProfit))} />
          <KPI label="Channels" value={String(items.length)} />
        </div>
        {channelData.length > 0 && (
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Revenue &amp; Profit by Channel</CardTitle></CardHeader>
            <CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={channelData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v: number) => money(v)} /><Legend /><Bar dataKey="revenue" fill="#10b981" name="Revenue" /><Bar dataKey="profit" fill="#06b6d4" name="Profit" /></BarChart></ResponsiveContainer></CardContent>
          </Card>
        )}
        <Card><CardContent className="p-3">
          <DataTable rows={items.map((i: any) => ({ id: i.channelId, ...i }))} loading={false} page={1} totalPages={1} total={items.length} limit={20} columns={[
            { key: "name", header: "Channel", render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: "orders", header: "Orders", render: (r: any) => r.orders },
            { key: "revenue", header: "Revenue", render: (r: any) => money(r.revenue) },
            { key: "paid", header: "Paid", render: (r: any) => money(r.paid) },
            { key: "cogs", header: "COGS", render: (r: any) => money(r.cogs) },
            { key: "profit", header: "Profit", render: (r: any) => <span className={num(r.profit) >= 0 ? "text-emerald-600" : "text-red-600"}>{money(r.profit)}</span> },
            { key: "aov", header: "Avg Order Value", render: (r: any) => money(r.averageOrderValue) },
          ]} />
        </CardContent></Card>
      </div>
    );
  }

  if (type === "cash-flow") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPI label="Opening Balance" value={money(data.openingBalance ?? "0")} />
          <KPI label="Cash Sales" value={money(data.cashSales ?? "0")} />
          <KPI label="Customer Payments" value={money(data.customerPayments ?? "0")} />
          <KPI label="Refunds" value={money(data.refunds ?? "0")} />
          <KPI label="Expenses" value={money(data.expenses ?? "0")} />
          <KPI label="Closing Balance" value={money(data.closingBalance ?? "0")} />
        </div>
      </div>
    );
  }

  if (type === "suppliers") {
    return (
      <Card><CardContent className="p-3">
        <DataTable rows={(data.items ?? []).map((i: any) => ({ id: i.id, ...i }))} loading={false} page={1} totalPages={1} total={data.items?.length ?? 0} limit={50} columns={[
          { key: "name", header: "Supplier", render: (r: any) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.company}</div></div> },
          { key: "purchases", header: "Purchases", render: (r: any) => r.purchaseCount },
          { key: "total", header: "Total", render: (r: any) => money(r.totalPurchases) },
          { key: "paid", header: "Paid", render: (r: any) => money(r.totalPaid) },
          { key: "due", header: "Payable", render: (r: any) => <span className={num(r.totalDue) > 0 ? "text-amber-600 font-medium" : ""}>{money(r.totalDue)}</span> },
        ]} />
      </CardContent></Card>
    );
  }

  if (type === "dues") {
    const totalDue = (data.items ?? []).reduce((s: number, c: any) => s + num(c.totalDue), 0);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <KPI label="Customers with dues" value={String(data.items?.length ?? 0)} />
          <KPI label="Total Outstanding" value={money(String(totalDue.toFixed(2)))} />
        </div>
        <Card><CardContent className="p-3">
          <DataTable rows={(data.items ?? []).map((i: any) => ({ id: i.id, ...i }))} loading={false} page={1} totalPages={1} total={data.items?.length ?? 0} limit={50} columns={[
            { key: "name", header: "Customer", render: (r: any) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.phone}</div></div> },
            { key: "orders", header: "Orders", render: (r: any) => r.orderCount },
            { key: "sales", header: "Total Sales", render: (r: any) => money(r.totalSales) },
            { key: "paid", header: "Paid", render: (r: any) => money(r.totalPaid) },
            { key: "advance", header: "Advance", render: (r: any) => money(r.advance) },
            { key: "due", header: "Due", render: (r: any) => <span className="text-amber-600 font-bold">{money(r.totalDue)}</span> },
          ]} />
        </CardContent></Card>
      </div>
    );
  }

  return null;
}

function KPI({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="font-bold text-lg">{value}</div></div>;
}
