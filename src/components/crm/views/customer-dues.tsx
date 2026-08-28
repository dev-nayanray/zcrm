"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coins, AlertCircle, Users, TrendingDown } from "lucide-react";
import { PageHeader, DataTable } from "../ui";
import { toast } from "sonner";

type Customer = { id: string; name: string; phone: string; email?: string | null; city?: string | null; orderCount: number; totalSales: string; totalPaid: string; totalDue: string; totalRefund: string; advance: string; creditLimit: string };

export function CustomerDuesView() {
  const { navigate } = useCrmStore();
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("DUE");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page)); p.set("limit", String(limit));
      if (search) p.set("search", search);
      if (status) p.set("status", status);
      const res = await api.get<{ items: Customer[]; total: number }>(`/api/v1/customers/dues?${p}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, status]);
  useEffect(() => { setPage(1); load(); }, [search]);

  const totalDue = rows.reduce((s, r) => s + num(r.totalDue), 0);
  const customersWithDue = rows.filter((r) => num(r.totalDue) > 0).length;
  const totalSales = rows.reduce((s, r) => s + num(r.totalSales), 0);
  const totalPaid = rows.reduce((s, r) => s + num(r.totalPaid), 0);

  return (
    <div>
      <PageHeader title="Customer Dues" description="Customers with outstanding balances. Due is computed live from orders − payments + refunds." action={
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="DUE">Has due</SelectItem><SelectItem value="PAID">Fully paid</SelectItem><SelectItem value="ALL">All</SelectItem></SelectContent>
        </Select>
      } />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <div><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Outstanding</p><p className="text-xl font-bold tabular-nums mt-1 text-red-600 dark:text-red-400">{money(totalDue.toFixed(2))}</p></div>
            <div className="h-10 w-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center ring-1 ring-red-500/20"><Coins className="h-5 w-5" /></div>
          </div>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <div><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Customers w/ Due</p><p className="text-xl font-bold tabular-nums mt-1">{customersWithDue}</p></div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center ring-1 ring-amber-500/20"><Users className="h-5 w-5" /></div>
          </div>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <div><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Sales</p><p className="text-xl font-bold tabular-nums mt-1">{money(totalSales.toFixed(2))}</p></div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-500/20"><TrendingDown className="h-5 w-5 rotate-180" /></div>
          </div>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <div><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Collected</p><p className="text-xl font-bold tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">{money(totalPaid.toFixed(2))}</p></div>
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center ring-1 ring-cyan-500/20"><Coins className="h-5 w-5" /></div>
          </div>
        </div>
      </div>

      <DataTable<Customer>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
        onPage={setPage} search={search} onSearch={setSearch}
        onRowClick={(r) => navigate("customers/detail", { id: r.id })}
        columns={[
          { key: "name", header: "Customer", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.phone}</div></div> },
          { key: "orders", header: "Orders", render: (r) => r.orderCount },
          { key: "sales", header: "Total Sales", render: (r) => <span className="tabular-nums">{money(r.totalSales)}</span> },
          { key: "paid", header: "Paid", render: (r) => <span className="tabular-nums text-muted-foreground">{money(r.totalPaid)}</span> },
          { key: "refund", header: "Refund", render: (r) => <span className="tabular-nums">{money(r.totalRefund)}</span> },
          { key: "advance", header: "Advance", render: (r) => <span className="tabular-nums">{money(r.advance)}</span> },
          { key: "due", header: "Due", render: (r) => <span className={`font-bold tabular-nums ${num(r.totalDue) > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{money(r.totalDue)}</span> },
          { key: "limit", header: "Credit Limit", render: (r) => <span className="tabular-nums text-muted-foreground">{money(r.creditLimit)}</span> },
        ]}
      />
    </div>
  );
}
