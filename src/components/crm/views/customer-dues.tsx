"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coins } from "lucide-react";
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

  return (
    <div>
      <PageHeader title="Customer Dues" description="Customers with outstanding balances. Total due shown live." action={
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="DUE">Has due</SelectItem><SelectItem value="PAID">Fully paid</SelectItem><SelectItem value="ALL">All</SelectItem></SelectContent>
        </Select>
      } />
      <div className="rounded-md border bg-primary/5 p-3 mb-3 flex items-center gap-2"><Coins className="h-5 w-5 text-primary" /><div><div className="text-xs text-muted-foreground">Total Outstanding</div><div className="text-xl font-bold">{money(totalDue.toFixed(2))}</div></div></div>
      <DataTable<Customer>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
        onPage={setPage} search={search} onSearch={setSearch}
        onRowClick={(r) => navigate("customers/detail", { id: r.id })}
        columns={[
          { key: "name", header: "Customer", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.phone}</div></div> },
          { key: "orders", header: "Orders", render: (r) => r.orderCount },
          { key: "sales", header: "Total Sales", render: (r) => money(r.totalSales) },
          { key: "paid", header: "Paid", render: (r) => money(r.totalPaid) },
          { key: "refund", header: "Refund", render: (r) => money(r.totalRefund) },
          { key: "advance", header: "Advance", render: (r) => money(r.advance) },
          { key: "due", header: "Due", render: (r) => <span className={num(r.totalDue) > 0 ? "text-amber-600 font-bold" : ""}>{money(r.totalDue)}</span> },
          { key: "limit", header: "Credit Limit", render: (r) => money(r.creditLimit) },
        ]}
      />
    </div>
  );
}
